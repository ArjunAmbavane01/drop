"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent as ReactClipboardEvent } from "react";
import { toast } from "sonner";
import { completeUploadsAction, preValidateUploadAction } from "@/server/rooms/actions";
import type { CompleteUploadInput } from "@/lib/validators";
import { LIMITS } from "@/lib/limits";
import { compileExclusionMatcher } from "@/lib/exclusions";
import type { UploadGroup, UploadState } from "./types";
import { groupFilesForUpload } from "./file-tree-utils";

export function useFileUpload(roomId: string, exclusions: string[]) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [pendingFolderUpload, setPendingFolderUpload] = useState<{
    group: UploadGroup;
    excludedCount: number;
  } | null>(null);

  const pendingResolverRef = useRef<((choice: "skip" | "cancel") => void) | null>(null);

  function confirmFolderUpload(choice: "skip" | "cancel") {
    if (pendingResolverRef.current) {
      pendingResolverRef.current(choice);
    }
  }

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
      const filesToValidate = group.files.map((f) => ({
        name: f.relativePath,
        size: f.file.size,
      }));

      const validationResult = await preValidateUploadAction(roomId, filesToValidate, {
        isFolder: group.type === "folder",
        includeExcluded: group.includeExcluded,
      });
      if (!validationResult.success) {
        let errorMessage = "Upload validation failed.";
        const err = validationResult.error;
        const file = validationResult.fileName;

        if (err === "too-many-files") {
          errorMessage = `That upload contains more than ${LIMITS.MAX_FILES_PER_UPLOAD} files. Split the folder into smaller uploads or exclude generated folders such as node_modules.`;
        } else if (err === "file-too-large") {
          errorMessage = `File "${file}" exceeds the 2 GB individual file limit.`;
        } else if (err === "path-too-long") {
          errorMessage = `File path exceeds the maximum limit of ${LIMITS.MAX_PATH_LENGTH} characters. (File: ${file})`;
        } else if (err === "invalid-path") {
          errorMessage = `File path contains invalid characters or traversal attempts. (File: ${file})`;
        } else if (err === "filename-too-long") {
          errorMessage = `Filename exceeds the maximum limit of ${LIMITS.MAX_FILENAME_LENGTH} characters. (File: ${file})`;
        } else if (err === "folder-depth-exceeded") {
          errorMessage = `Folder depth exceeds the maximum limit of ${LIMITS.MAX_FOLDER_DEPTH} levels. (File: ${file})`;
        } else if (err === "duplicate-path") {
          errorMessage = `Duplicate file paths detected. (Path: ${file})`;
        } else if (err === "conflicting-path") {
          errorMessage = `Conflicting paths detected: a path cannot be both a file and a folder. (Path: ${file})`;
        } else if (err === "user-quota-exceeded") {
          errorMessage = "Your personal storage quota (3 GB) is exceeded.";
        } else if (err === "room-quota-exceeded") {
          errorMessage = "The room storage quota (5 GB) is exceeded.";
        } else if (err === "upload-rate-limit-exceeded") {
          errorMessage = `Upload rate limit exceeded. You can initiate up to ${LIMITS.MAX_UPLOAD_SESSIONS_PER_MIN} upload sessions per minute.`;
        }

        toast.error(errorMessage);
        setUploads((prev) => prev.filter((u) => u.id !== group.id));
        return;
      }

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
            if (validationResult.uploadToken) {
              request.setRequestHeader("X-Upload-Token", validationResult.uploadToken);
            }
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

      if (group.skippedCount && group.skippedCount > 0) {
        toast.info(`Skipped ${group.skippedCount.toLocaleString()} files based on your upload exclusions.`);
      }

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

    setIsProcessing(true);
    // Yield to let the UI update (e.g. unfreeze browser dialog, show loading overlay)
    await new Promise((r) => setTimeout(r, 50));

    try {
      const uploadGroups = groupFilesForUpload(validFiles);
      const matcher = compileExclusionMatcher(exclusions);

      for (const group of uploadGroups) {
        if (group.type === "file") {
          executeGroupUpload(group);
        } else {
          const excludedFiles = group.files.filter((f) => matcher(f.relativePath));
          if (excludedFiles.length > 0) {
            setPendingFolderUpload({
              group,
              excludedCount: excludedFiles.length,
            });

            const choice = await new Promise<"skip" | "cancel">((resolve) => {
              pendingResolverRef.current = resolve;
            });

            setPendingFolderUpload(null);
            pendingResolverRef.current = null;

            if (choice === "skip") {
              const nonExcludedFiles = group.files.filter((f) => !matcher(f.relativePath));
              executeGroupUpload({
                ...group,
                files: nonExcludedFiles,
                skippedCount: excludedFiles.length,
              });
            }
          } else {
            executeGroupUpload(group);
          }
        }
      }
    } finally {
      setIsProcessing(false);
    }
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

  // Explicit Clipboard upload handler (e.g. from button click)
  async function handleClipboardUpload() {
    try {
      if (!navigator.clipboard?.read) {
        toast.error("Clipboard access is not supported in this browser.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (imageType) {
          const blob = await item.getType(imageType);
          const extension = imageType.split("/")[1] || "png";

          files.push(
            new File(
              [blob],
              `pasted-image-${Date.now()}.${extension}`,
              { type: imageType }
            )
          );

          continue;
        }

        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();

          if (text.trim()) {
            files.push(
              new File(
                [blob],
                `pasted-text-${Date.now()}.txt`,
                { type: "text/plain" }
              )
            );
          }
        }
      }

      if (files.length === 0) {
        toast.error("No image or text found in clipboard.");
        return;
      }

      await handleUploadStart(files);
    } catch (error) {
      console.error("Clipboard upload failed:", error);
      toast.error("Failed to read from clipboard. Please try again.");
    }
  }

  // Local Dropzone paste handler (triggers when focused and user presses Ctrl+V)
  async function handleClipboardPaste(
    event: React.ClipboardEvent<HTMLDivElement>
  ) {
    const items = Array.from(event.clipboardData.items);

    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));

    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) await handleUploadStart([file]);
      return;
    }

    const text = event.clipboardData.getData("text/plain");

    if (text.trim()) {
      event.preventDefault();

      const file = new File(
        [text],
        `pasted-text-${Date.now()}.txt`,
        { type: "text/plain" }
      );

      await handleUploadStart([file]);
    }
  }

  return {
    uploads,
    isDragging,
    isProcessing,
    fileInputRef,
    folderInputRef,
    handlePickerChange,
    handleDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    cancelUpload,
    handleRetryUpload,
    pendingFolderUpload,
    confirmFolderUpload,
    handleClipboardUpload,
    handleClipboardPaste,
  };
}
