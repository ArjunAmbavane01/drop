"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { completeUploadsAction } from "@/server/rooms/actions";
import type { CompleteUploadInput } from "@/lib/validators";
import { MAX_UPLOAD_FILES } from "@/lib/constants";
import type { UploadGroup, UploadState } from "./types";
import { groupFilesForUpload } from "./file-tree-utils";

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
    const totalBytes = group.files.reduce((sum, f) => sum + f.file.size, 0);
    const activeRequests: XMLHttpRequest[] = [];

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
            group,
          },
          ...prev,
        ];
      }
    });

    const fileProgresses = new Map<string, number>();

    try {
      const successfulUploads: CompleteUploadInput[] = [];

      // Stream uploads through the backend so the browser never needs direct R2 access.
      await Promise.all(
        group.files.map(async (fileInfo) => {
          const { file, relativePath } = fileInfo;

          const objectKey = await new Promise<string>((resolve, reject) => {
            const request = new XMLHttpRequest();
            activeRequests.push(request);

            request.upload.addEventListener("progress", (event) => {
              if (!event.lengthComputable) return;
              fileProgresses.set(relativePath, event.loaded);

              let totalUploaded = 0;
              for (const bytes of fileProgresses.values()) {
                totalUploaded += bytes;
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

            request.addEventListener("load", () => {
              if (request.status >= 200 && request.status < 300) {
                fileProgresses.set(relativePath, file.size);
                try {
                  const response = JSON.parse(request.responseText || "{}");
                  if (typeof response?.objectKey === "string" && response.objectKey.length > 0) {
                    resolve(response.objectKey);
                    return;
                  }
                  reject(new Error("Upload completed without an object key."));
                } catch {
                  reject(new Error("Upload completed without a valid response."));
                }
              } else {
                try {
                  const response = JSON.parse(request.responseText || "{}");
                  reject(new Error(response.error || `Upload failed with status ${request.status}`));
                } catch {
                  reject(new Error(`Upload failed with status ${request.status}`));
                }
              }
            });

            request.addEventListener("error", () => reject(new Error("Network error during upload.")));
            request.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
            request.open("POST", `/api/rooms/${roomId}/uploads`);
            request.setRequestHeader("X-File-Name", encodeURIComponent(relativePath));
            request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            request.setRequestHeader("X-File-Size", String(file.size));
            if (group.type === "folder") {
              request.setRequestHeader("X-Upload-Id", group.id);
            }
            request.send(file);
          });

          // Upload was successful, add to database complete queue
          successfulUploads.push({
            objectKey,
            fileName: relativePath,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            uploadId: group.type === "folder" ? group.id : undefined,
            folderName: group.type === "folder" ? group.name : undefined,
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
