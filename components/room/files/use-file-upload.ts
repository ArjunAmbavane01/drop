"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  createUploadUrlsAction,
  completeUploadsAction,
} from "@/server/rooms/actions";
import type { CompleteUploadInput } from "@/lib/validators";
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
      // 1. Get pre-signed upload URLs in batch
      const signedUrls = await createUploadUrlsAction(
        roomId,
        group.files.map((fileInfo) => ({
          fileName: fileInfo.relativePath,
          contentType: fileInfo.file.type || "application/octet-stream",
          sizeBytes: fileInfo.file.size,
          uploadId: group.type === "folder" ? group.id : undefined,
        })),
      );

      const successfulUploads: CompleteUploadInput[] = [];

      // 2. Direct upload to R2 with XMLHttpRequest progress reporting in parallel
      await Promise.all(
        group.files.map(async (fileInfo) => {
          const { file, relativePath } = fileInfo;
          const signed = signedUrls.find((s) => s.fileName === relativePath);
          if (!signed) {
            throw new Error(`Failed to generate upload URL for: ${relativePath}`);
          }

          await new Promise<void>((resolve, reject) => {
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
                resolve();
              } else {
                reject(new Error(`Upload failed with status ${request.status}`));
              }
            });

            request.addEventListener("error", () => reject(new Error("Network error during upload.")));
            request.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
            request.open("PUT", signed.uploadUrl);
            request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            request.send(file);
          });

          // Upload was successful, add to database complete queue
          successfulUploads.push({
            objectKey: signed.objectKey,
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
    const validFiles = fileList.filter((file) => file.size >= 0);
    if (validFiles.length === 0) return;

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
