"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  completeUploadsAction,
  preValidateUploadAction,
  getRoomPublicKeysAction,
} from "@/server/rooms/actions";
import type { CompleteUploadInput } from "@/lib/validators";
import { LIMITS } from "@/lib/limits";
import { compileExclusionMatcher } from "@/lib/exclusions";
import type { UploadGroup, UploadState } from "./types";
import { getFilePath, groupFilesForUploadAsync } from "./file-tree-utils";
import {
  getEncryptedSize,
  generateFileKey,
  wrapFileKey,
  importPublicKeySpki,
  encryptFileToBlob,
} from "@/lib/e2ee";
import type { DirectQueueControls } from "@/lib/direct-transfer/types";
import type { UploadMode } from "./types";

type UploadFileSource = File[] | FileList;

async function buildValidationFiles(group: UploadGroup) {
  const files: { name: string; size: number }[] = [];
  for (let i = 0; i < group.files.length; i++) {
    const file = group.files[i];
    files.push({ name: file.relativePath, size: file.file.size });
    if ((i + 1) % 500 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return files;
}

export function useFileUpload(
  roomId: string,
  exclusions: string[],
  options: {
    mode?: UploadMode;
    onDirectGroup?: (group: UploadGroup, controls: DirectQueueControls) => void;
    onDirectCancel?: (id: string) => void;
  } = {},
) {
  const mode = options.mode ?? "persistent";
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [pendingFolderUpload, setPendingFolderUpload] = useState<{
    group: UploadGroup;
    excludedCount: number;
  } | null>(null);

  const pendingResolverRef = useRef<((choice: "skip" | "cancel") => void) | null>(null);
  const uploadGroupsRef = useRef(new Map<string, UploadGroup>());
  const cancelledUploadIdsRef = useRef(new Set<string>());
  const pendingMetadataGroupsRef = useRef(new Map<string, UploadGroup>());
  const metadataFlushScheduledRef = useRef(false);

  type PendingConfirmation = {
    group: UploadGroup;
    excludedCount: number;
    resolve: (choice: "skip" | "cancel") => void;
  };
  const confirmationQueueRef = useRef<PendingConfirmation[]>([]);
  const activeConfirmationRef = useRef<PendingConfirmation | null>(null);

  function confirmFolderUpload(choice: "skip" | "cancel") {
    const resolver = pendingResolverRef.current;
    if (!resolver) return;
    pendingResolverRef.current = null;
    activeConfirmationRef.current = null;
    setPendingFolderUpload(null);
    resolver(choice);
    showNextFolderConfirmation();
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

  function showNextFolderConfirmation() {
    if (activeConfirmationRef.current || confirmationQueueRef.current.length === 0) return;
    const next = confirmationQueueRef.current.shift();
    if (!next) return;
    activeConfirmationRef.current = next;
    pendingResolverRef.current = next.resolve;
    setPendingFolderUpload({ group: next.group, excludedCount: next.excludedCount });
  }

  function requestFolderConfirmation(group: UploadGroup, excludedCount: number) {
    return new Promise<"skip" | "cancel">((resolve) => {
      confirmationQueueRef.current.push({ group, excludedCount, resolve });
      showNextFolderConfirmation();
    });
  }

  function addUploadToQueue(group: UploadGroup) {
    addUploadsToQueue([group]);
  }

  function addUploadsToQueue(groups: UploadGroup[]) {
    const nextGroups = groups.filter((group) => !cancelledUploadIdsRef.current.has(group.id));
    if (nextGroups.length === 0) return;
    for (const group of nextGroups) uploadGroupsRef.current.set(group.id, group);

    setUploads((prev) => {
      const existingIds = new Set(prev.map((upload) => upload.id));
      const newUploads = nextGroups
        .filter((group) => !existingIds.has(group.id))
        .map((group): UploadState => ({
          id: group.id,
          name: group.name,
          type: group.type,
          status: "preparing",
          progress: 0,
          totalBytes: group.totalBytes ?? 0,
          uploadedBytes: 0,
          fileCount: group.fileCount,
          activeRequests: [],
          group,
        }));
      return newUploads.length > 0 ? [...newUploads, ...prev] : prev;
    });
  }

  function updateQueuedGroupMetadata(groups: UploadGroup[]) {
    for (const group of groups) {
      uploadGroupsRef.current.set(group.id, group);
      pendingMetadataGroupsRef.current.set(group.id, group);
    }
    if (metadataFlushScheduledRef.current) return;

    metadataFlushScheduledRef.current = true;
    const flush = () => {
      metadataFlushScheduledRef.current = false;
      const pendingGroups = Array.from(pendingMetadataGroupsRef.current.values());
      pendingMetadataGroupsRef.current.clear();
      if (pendingGroups.length === 0) return;

      const byId = new Map(pendingGroups.map((group) => [group.id, group]));
      setUploads((prev) => {
        let changed = false;
        const next = prev.map((upload) => {
          const group = byId.get(upload.id);
      if (!group || upload.status !== "preparing") return upload;

          const totalBytes = group.totalBytes ?? upload.totalBytes;
          const fileCount = group.fileCount ?? upload.fileCount;
          if (totalBytes === upload.totalBytes && fileCount === upload.fileCount) return upload;

          changed = true;
          return { ...upload, totalBytes, fileCount };
        });
        return changed ? next : prev;
      });
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 16);
    }
  }

  function markUploadGroupReady(group: UploadGroup) {
    uploadGroupsRef.current.set(group.id, group);
    setUploads((prev) => prev.map((upload) => upload.id === group.id
      ? { ...upload, group, totalBytes: group.totalBytes ?? upload.totalBytes, fileCount: group.fileCount }
      : upload));
  }

  function getQueueControls(id: string): DirectQueueControls {
    return {
      update: (update) => setUploads((prev) => prev.map((upload) => upload.id === id ? { ...upload, ...update } : upload)),
      complete: () => {
        setUploads((prev) => prev.map((upload) => upload.id === id ? { ...upload, status: "complete", progress: 100, uploadedBytes: upload.totalBytes } : upload));
        setTimeout(() => setUploads((prev) => prev.filter((upload) => upload.id !== id)), 700);
      },
      fail: (error) => setUploads((prev) => prev.map((upload) => upload.id === id ? { ...upload, status: "error", error } : upload)),
    };
  }

  async function executeGroupUpload(group: UploadGroup) {
    if (cancelledUploadIdsRef.current.has(group.id)) return;
    const totalBytes = group.totalBytes ?? group.files.reduce((sum, f) => sum + getEncryptedSize(f.file.size), 0);
    const activeRequests: XMLHttpRequest[] = [];
    const abortControllers: AbortController[] = [];

    setUploads((prev) => {
      const existing = prev.find((u) => u.id === group.id);
      if (existing) {
        return prev.map((u) =>
          u.id === group.id
            ? {
              ...u,
              name: group.name,
              type: group.type,
              status: "preparing",
              progress: 0,
              uploadedBytes: 0,
              totalBytes,
              fileCount: group.fileCount ?? group.files.length,
              activeRequests: [],
              abortControllers,
              group,
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
            status: "preparing",
            progress: 0,
            totalBytes,
            uploadedBytes: 0,
            fileCount: group.fileCount ?? group.files.length,
            activeRequests: [],
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
      const filesToValidate = await buildValidationFiles(group);

      const validationResult = await preValidateUploadAction(roomId, filesToValidate, {
        isFolder: group.type === "folder",
        includeExcluded: group.includeExcluded,
      });
      if (cancelledUploadIdsRef.current.has(group.id)) return;
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
        setUploads((prev) => prev.map((u) =>
          u.id === group.id ? { ...u, status: "error", error: errorMessage } : u,
        ));
        return;
      }

      setUploads((prev) => prev.map((upload) =>
        upload.id === group.id
          ? { ...upload, status: "uploading", activeRequests, group, totalBytes }
          : upload,
      ));

      const successfulUploads: CompleteUploadInput[] = [];

      await Promise.all(
        group.files.map(async (fileInfo) => {
          const { file, relativePath } = fileInfo;
          const encryptedSize = getEncryptedSize(file.size);
          const fileId = crypto.randomUUID();
          const fileKey = await generateFileKey();

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

          const encryptedBlob = await encryptFileToBlob(file, fileKey, fileId);

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
                fileProgresses.set(relativePath, encryptedSize);
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
            request.setRequestHeader("X-File-Size", String(encryptedSize));
            request.setRequestHeader("X-Original-File-Size", String(file.size));
            if (validationResult.uploadToken) {
              request.setRequestHeader("X-Upload-Token", validationResult.uploadToken);
            }
            if (group.type === "folder") {
              request.setRequestHeader("X-Upload-Id", group.id);
            }
            request.send(encryptedBlob);
          });

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

  async function processUploadGroup(group: UploadGroup) {
    if (cancelledUploadIdsRef.current.has(group.id)) return;
    markUploadGroupReady(group);

    if (mode === "direct") {
      options.onDirectGroup?.(group, getQueueControls(group.id));
      return;
    }

    if (group.type === "file") {
      void executeGroupUpload(group);
      return;
    }

    const excludedCount = group.skippedCount ?? 0;
    if (excludedCount > 0) {
      const choice = await requestFolderConfirmation({
        ...group,
      }, excludedCount);

      if (cancelledUploadIdsRef.current.has(group.id)) return;
      if (choice === "cancel") {
        cancelUpload(group.id);
        return;
      }
      void executeGroupUpload(group);
      return;
    }

    void executeGroupUpload(group);
  }

  async function processUploadSelection(
    source: UploadFileSource,
    initialGroup: UploadGroup,
    exclusionMatcher: ReturnType<typeof compileExclusionMatcher> | undefined,
    onSourceConsumed?: () => void,
  ) {
    try {
      // Let the queue item commit before scanning a potentially very large FileList.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelledUploadIdsRef.current.has(initialGroup.id)) return;
      const uploadGroups = await groupFilesForUploadAsync(source, {
        initialGroupId: initialGroup.id,
        exclusionMatcher,
        onGroupsDiscovered: addUploadsToQueue,
        onGroupsUpdated: updateQueuedGroupMetadata,
      });

      for (const group of uploadGroups) {
        await processUploadGroup(group);
      }
    } catch (error) {
      if (cancelledUploadIdsRef.current.has(initialGroup.id)) return;
      const message = error instanceof Error ? error.message : "Unable to prepare upload.";
      setUploads((prev) => prev.map((upload) => upload.id === initialGroup.id
        ? { ...upload, status: "error", error: message }
        : upload));
      toast.error(`Upload preparation failed for ${initialGroup.name}`);
    } finally {
      onSourceConsumed?.();
    }
  }

  function handleUploadStart(source: UploadFileSource, onSourceConsumed?: () => void) {
    if (source.length === 0) return;

    const firstFile = source[0];
    const firstPath = getFilePath(firstFile);
    const firstSlash = firstPath.indexOf("/");
    const isFolder = firstSlash !== -1;
    const exclusionMatcher = isFolder ? compileExclusionMatcher(exclusions) : undefined;
    const relativePath = isFolder ? firstPath.substring(firstSlash + 1) : firstPath;
    const isFirstFileExcluded = Boolean(exclusionMatcher?.(relativePath));
    const initialGroup: UploadGroup = {
      id: crypto.randomUUID(),
      name: isFolder ? firstPath.substring(0, firstSlash) : firstFile.name,
      type: isFolder ? "folder" : "file",
      fileCount: isFirstFileExcluded ? 0 : 1,
      totalBytes: isFirstFileExcluded ? 0 : firstFile.size,
      files: isFirstFileExcluded ? [] : [{ file: firstFile, relativePath }],
      skippedCount: isFirstFileExcluded ? 1 : undefined,
    };

    // Queue first, then continue discovery and validation in yielding async work.
    addUploadToQueue(initialGroup);
    void processUploadSelection(source, initialGroup, exclusionMatcher, onSourceConsumed);
  }

  function cancelUpload(id: string) {
    cancelledUploadIdsRef.current.add(id);
    uploadGroupsRef.current.delete(id);
    if (mode === "direct") options.onDirectCancel?.(id);

    const activeConfirmation = activeConfirmationRef.current;
    if (activeConfirmation?.group.id === id) confirmFolderUpload("cancel");

    const remainingConfirmations: PendingConfirmation[] = [];
    for (const confirmation of confirmationQueueRef.current) {
      if (confirmation.group.id === id) confirmation.resolve("cancel");
      else remainingConfirmations.push(confirmation);
    }
    confirmationQueueRef.current = remainingConfirmations;

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
      cancelledUploadIdsRef.current.delete(id);
      if (mode === "direct") options.onDirectGroup?.(item.group, getQueueControls(item.id));
      else await executeGroupUpload(item.group);
    }
  }

  function resetPickers() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function handlePickerChange(event: ChangeEvent<HTMLInputElement>) {
    const picker = event.currentTarget;
    const nextFiles = picker.files;
    if (!nextFiles || nextFiles.length === 0) return;
    picker.disabled = true;
    handleUploadStart(nextFiles, () => {
      resetPickers();
      picker.disabled = false;
    });
  }

  const clearUploads = useCallback(() => {
    activeConfirmationRef.current?.resolve("cancel");
    for (const confirmation of confirmationQueueRef.current) confirmation.resolve("cancel");
    confirmationQueueRef.current = [];
    activeConfirmationRef.current = null;
    pendingResolverRef.current = null;
    setPendingFolderUpload(null);
    setUploads((previous) => {
      for (const upload of previous) upload.activeRequests.forEach((request) => request.abort());
      return [];
    });
    for (const groupId of uploadGroupsRef.current.keys()) cancelledUploadIdsRef.current.add(groupId);
    uploadGroupsRef.current.clear();
    pendingMetadataGroupsRef.current.clear();
  }, []);

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
    clearUploads,
  };
}
