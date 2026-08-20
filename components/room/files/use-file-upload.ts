"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  completeUploadsAction,
  preValidateUploadAction,
  getRoomPublicKeysAction,
} from "@/server/rooms/actions";
import type { CompleteUploadInput } from "@/lib/validators";
import { MAX_UPLOAD_FILES } from "@/lib/constants";
import type { UploadGroup, UploadState } from "./types";
import { groupFilesForUpload } from "./file-tree-utils";
import {
  getEncryptedSize,
  generateFileKey,
  wrapFileKey,
  importPublicKeySpki,
  encryptChunk,
  CHUNK_SIZE,
} from "@/lib/e2ee";

function createEncryptedStream(
  file: File,
  fileKey: CryptoKey,
  fileId: string,
  totalChunks: number,
  onProgress: (bytesRead: number) => void
) {
  let chunkIndex = 0;
  let offset = 0;

  return new ReadableStream({
    async pull(controller) {
      if (offset >= file.size) {
        controller.close();
        return;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();
      const chunkData = new Uint8Array(arrayBuffer);

      const encrypted = await encryptChunk(
        chunkData,
        fileKey,
        fileId,
        chunkIndex,
        totalChunks
      );

      controller.enqueue(encrypted);

      chunkIndex++;
      offset += chunkData.length;

      onProgress(encrypted.length);
    },
  });
}

export function useFileUpload(roomId: string) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  // Set webkitdirectory attribute for folder picker input
  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  async function executeGroupUpload(group: UploadGroup) {
    const totalBytes = group.files.reduce((sum, f) => sum + getEncryptedSize(f.file.size), 0);
    const activeRequests: XMLHttpRequest[] = [];
    const abortControllers: AbortController[] = [];

    setUploads((prev) => {
      const existing = prev.find((u) => u.id === group.id);
      if (existing) {
        return prev.map((u) =>
          u.id === group.id
            ? {
                ...u,
                status: "uploading",
                progress: 0,
                uploadedBytes: 0,
                activeRequests,
                abortControllers,
                error: undefined,
              }
            : u,
        );
      } else {
        return [
          {
            id: group.id,
            name: group.name,
            type: group.type,
            status: "uploading",
            progress: 0,
            totalBytes,
            uploadedBytes: 0,
            activeRequests,
            abortControllers,
            group,
          },
          ...prev,
        ];
      }
    });

    const fileProgresses = new Map<string, number>();

    try {
      const { keys: roomKeys } = await getRoomPublicKeysAction(roomId);

      const filesToValidate = group.files.map((f) => ({
        name: f.relativePath,
        size: getEncryptedSize(f.file.size),
      }));

      const validationResult = await preValidateUploadAction(roomId, filesToValidate);
      if (!validationResult.success) {
        let errorMessage = "Upload validation failed.";
        if (validationResult.error === "file-too-large") {
          errorMessage = `File "${validationResult.fileName}" exceeds the 2 GB individual file limit.`;
        } else if (validationResult.error === "user-quota-exceeded") {
          errorMessage = "Your personal storage quota (5 GB) is exceeded.";
        } else if (validationResult.error === "room-quota-exceeded") {
          errorMessage = "The room storage quota (5 GB) is exceeded.";
        } else if (validationResult.error === "upload-rate-limit-exceeded") {
          errorMessage = "Upload rate limit exceeded. You can initiate up to 200 files per minute.";
        }
        
        toast.error(errorMessage);
        setUploads((prev) => prev.filter((u) => u.id !== group.id));
        return;
      }

      const successfulUploads: CompleteUploadInput[] = [];

      await Promise.all(
        group.files.map(async (fileInfo) => {
          const { file, relativePath } = fileInfo;
          const encryptedSize = getEncryptedSize(file.size);
          const fileId = crypto.randomUUID();
          const fileKey = await generateFileKey();
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

          const wrappedKeys = [];
          for (const keyInfo of roomKeys) {
            try {
              const rsaPubKey = await importPublicKeySpki(keyInfo.publicKey);
              const encryptedKey = await wrapFileKey(fileKey, rsaPubKey);
              wrappedKeys.push({
                publicKeyId: keyInfo.id,
                encryptedKey,
              });
            } catch (err) {
              console.error("Failed to wrap key for member public key:", keyInfo.id, err);
            }
          }

          const abortController = new AbortController();
          abortControllers.push(abortController);

          fileProgresses.set(relativePath, 0);

          const stream = createEncryptedStream(file, fileKey, fileId, totalChunks, (bytes) => {
            const current = fileProgresses.get(relativePath) || 0;
            fileProgresses.set(relativePath, current + bytes);

            let totalUploaded = 0;
            for (const b of fileProgresses.values()) {
              totalUploaded += b;
            }

            const progress = totalBytes > 0 ? Math.round((totalUploaded / totalBytes) * 100) : 0;

            setUploads((prev) =>
              prev.map((u) =>
                u.id === group.id
                  ? { ...u, uploadedBytes: totalUploaded, progress: Math.min(progress, 99) }
                  : u,
              ),
            );
          });

          const response = await fetch(`/api/rooms/${roomId}/uploads`, {
            method: "POST",
            headers: {
              "X-File-Name": encodeURIComponent(relativePath),
              "Content-Type": file.type || "application/octet-stream",
              "X-File-Size": String(encryptedSize),
              ...(validationResult.uploadToken ? { "X-Upload-Token": validationResult.uploadToken } : {}),
              ...(group.type === "folder" ? { "X-Upload-Id": group.id } : {}),
            },
            body: stream as unknown as BodyInit,
            // @ts-expect-error - duplex is not standard in all fetch typings
            duplex: "half",
            signal: abortController.signal,
          });

          if (!response.ok) {
            const responseText = await response.text();
            let errMsg = `Upload failed with status ${response.status}`;
            try {
              const parsed = JSON.parse(responseText);
              errMsg = parsed.error || errMsg;
            } catch {}
            throw new Error(errMsg);
          }

          const responseData = await response.json();
          const objectKey = responseData.objectKey;

          successfulUploads.push({
            fileId,
            objectKey,
            fileName: relativePath,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            uploadId: group.type === "folder" ? group.id : undefined,
            folderName: group.type === "folder" ? group.name : undefined,
            wrappedKeys,
          });
        }),
      );

      // 3. Complete all successfully uploaded files in batch
      if (successfulUploads.length > 0) {
        await completeUploadsAction(roomId, successfulUploads);
      }

      // Mark upload as complete
      setUploads((prev) =>
        prev.map((u) =>
          u.id === group.id
            ? { ...u, status: "complete", progress: 100, uploadedBytes: totalBytes }
            : u,
        ),
      );

      // Auto-dismiss completed upload notification bar after short delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== group.id));
      }, 700);
    } catch (error) {
      const wasAborted = activeRequests.some((xhr) => xhr.readyState === 0 || xhr.status === 0);
      if (wasAborted) return;

      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setUploads((prev) =>
        prev.map((u) =>
          u.id === group.id ? { ...u, status: "error", error: errorMessage } : u,
        ),
      );
      toast.error(`Upload failed for ${group.name}`);
    }
  }

  async function handleUploadStart(fileList: File[]) {
    let validFiles = fileList.filter((file) => file.size >= 0);
    if (validFiles.length === 0) return;

    if (validFiles.length > MAX_UPLOAD_FILES) {
      toast.warning(`Too many files selected. Only the first ${MAX_UPLOAD_FILES} will be uploaded.`);
      validFiles = validFiles.slice(0, MAX_UPLOAD_FILES);
    }

    const uploadGroups = groupFilesForUpload(validFiles);
    await Promise.all(uploadGroups.map((group) => executeGroupUpload(group)));
  }

  function cancelUpload(id: string) {
    setUploads((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item) {
        item.activeRequests.forEach((xhr) => xhr.abort());
        item.abortControllers?.forEach((ac) => ac.abort());
      }
      return prev.filter((u) => u.id !== id);
    });
  }

  async function handleRetryUpload(id: string) {
    const item = uploads.find((u) => u.id === id);
    if (item) {
      await executeGroupUpload(item.group);
    }
  }

  function resetPickers() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  async function handlePickerChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    resetPickers();
    await handleUploadStart(nextFiles);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    await handleUploadStart(droppedFiles);
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      setIsDragging(false);
      dragDepthRef.current = 0;
    }
  }

  const handleUploadStartRef = useRef(handleUploadStart);

  useEffect(() => {
    handleUploadStartRef.current = handleUploadStart;
  });

  // Global paste handler
  useEffect(() => {
    async function handlePaste(event: ClipboardEvent) {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length === 0) return;
      event.preventDefault();
      await handleUploadStartRef.current(clipboardFiles);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  return {
    uploads,
    isDragging,
    fileInputRef,
    folderInputRef,
    handlePickerChange,
    handleDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    cancelUpload,
    handleRetryUpload,
  };
}
