"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  FolderUp,
  Pencil,
  Trash2,
  Upload,
  File,
  ChevronRight,
  Folder,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import { fetchJson } from "@/lib/fetcher";
import {
  renameFileAction,
  renameFolderAction,
  deleteFileAction,
  deleteFolderAction,
} from "@/server/rooms/actions";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getFileIcon, FileIconMap } from "./file-icons";
import {
  Files,
  FolderItem as AnimateFolderItem,
  FolderTrigger as AnimateFolderTrigger,
  FolderContent as AnimateFolderContent,
  FileItem as AnimateFileItem,
  SubFiles as AnimateSubFiles,
} from "@/components/animate-ui/components/radix/files";

type UploadSignerResponse = { objectKey: string; uploadUrl: string };

type UploadGroup = {
  id: string; // uploadId for folders, random ID for files
  name: string; // folder name or file name
  type: "file" | "folder";
  files: {
    file: File;
    relativePath: string; // relative path within folder or simple name
  }[];
};

type UploadState = {
  id: string;
  name: string;
  type: "file" | "folder";
  status: "uploading" | "complete" | "error";
  progress: number;
  totalBytes: number;
  uploadedBytes: number;
  error?: string;
  activeRequests: XMLHttpRequest[];
  group: UploadGroup;
};

// Tree node definition for folders
interface TreeNode {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  file?: RoomFile;
  children: Record<string, TreeNode>;
}

// Group files and folders for flat list
type FolderItem = {
  type: "folder";
  uploadId: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
  uploader: RoomFile["uploader"];
  files: RoomFile[];
};

type FileItem = {
  type: "file";
  file: RoomFile;
};

type TopLevelItem = FolderItem | FileItem;

function groupFilesAndFolders(files: RoomFile[]): TopLevelItem[] {
  const foldersMap: Record<string, FolderItem> = {};
  const items: TopLevelItem[] = [];

  for (const file of files) {
    if (file.uploadId) {
      if (!foldersMap[file.uploadId]) {
        foldersMap[file.uploadId] = {
          type: "folder",
          uploadId: file.uploadId,
          name: file.uploadName || "Untitled Folder",
          sizeBytes: 0,
          uploadedAt: file.uploadedAt,
          uploader: file.uploader,
          files: [],
        };
      }
      const folder = foldersMap[file.uploadId];
      folder.files.push(file);
      folder.sizeBytes += file.sizeBytes;
      if (new Date(file.uploadedAt) > new Date(folder.uploadedAt)) {
        folder.uploadedAt = file.uploadedAt;
      }
    } else {
      items.push({
        type: "file",
        file,
      });
    }
  }

  for (const uploadId in foldersMap) {
    items.push(foldersMap[uploadId]);
  }

  items.sort((a, b) => {
    const timeA = new Date(a.type === "folder" ? a.uploadedAt : a.file.uploadedAt).getTime();
    const timeB = new Date(b.type === "folder" ? b.uploadedAt : b.file.uploadedAt).getTime();
    return timeB - timeA;
  });

  return items;
}

function buildTree(folderFiles: RoomFile[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const file of folderFiles) {
    const parts = file.fileName.split("/");
    let currentLevel = root;
    let accumulatedPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          relativePath: accumulatedPath,
          type: isLast ? "file" : "directory",
          children: {},
          file: isLast ? file : undefined,
        };
      }
      currentLevel = currentLevel[part].children;
    }
  }

  return root;
}

export function FilesPanel({
  roomId,
  files,
  onFileRename,
  onFileDelete,
  onFolderRename,
  onFolderDelete,
}: {
  roomId: string;
  files: RoomFile[];
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
  onFolderRename: (uploadId: string, name: string) => void;
  onFolderDelete: (uploadId: string) => void;
}) {
  const [renameTarget, setRenameTarget] = useState<RoomFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    async function handlePaste(event: ClipboardEvent) {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length === 0) return;
      event.preventDefault();
      await handleUploadStart(clipboardFiles);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  function togglePath(path: string) {
    setExpandedPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }

  function getFilePath(file: File) {
    const relativePath = "webkitRelativePath" in file ? (file.webkitRelativePath as string) : "";
    return relativePath || file.name;
  }

  function groupFilesForUpload(fileList: File[]): UploadGroup[] {
    const groups: Record<string, UploadGroup> = {};
    const result: UploadGroup[] = [];

    for (const file of fileList) {
      const relPath = getFilePath(file);
      
      if (relPath && relPath.includes("/")) {
        const parts = relPath.split("/");
        const rootFolder = parts[0];
        const subPath = parts.slice(1).join("/");

        if (!groups[rootFolder]) {
          groups[rootFolder] = {
            id: crypto.randomUUID(),
            name: rootFolder,
            type: "folder",
            files: [],
          };
        }
        groups[rootFolder].files.push({
          file,
          relativePath: subPath,
        });
      } else {
        result.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: "file",
          files: [{ file, relativePath: file.name }],
        });
      }
    }

    for (const rootFolder in groups) {
      result.push(groups[rootFolder]);
    }

    return result;
  }

  async function handleUploadStart(fileList: File[]) {
    const validFiles = fileList.filter((file) => file.size >= 0);
    if (validFiles.length === 0) return;

    const uploadGroups = groupFilesForUpload(validFiles);

    // Run all group uploads
    await Promise.all(uploadGroups.map(group => executeGroupUpload(group)));
  }

  async function executeGroupUpload(group: UploadGroup) {
    const totalBytes = group.files.reduce((sum, f) => sum + f.file.size, 0);
    const activeRequests: XMLHttpRequest[] = [];

    // Add or reset the queue item
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
      await Promise.all(
        group.files.map(async (fileInfo) => {
          const { file, relativePath } = fileInfo;

          // 1. Get pre-signed URL from API
          const signed = await fetchJson<UploadSignerResponse>(`/api/rooms/${roomId}/uploads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: relativePath,
              contentType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              uploadId: group.type === "folder" ? group.id : undefined,
            }),
          });

          // 2. Upload file to R2 with XMLHttpRequest progress reporting
          await new Promise<void>((resolve, reject) => {
            const request = new XMLHttpRequest();
            activeRequests.push(request);

            request.upload.addEventListener("progress", (event) => {
              if (!event.lengthComputable) return;
              fileProgresses.set(relativePath, event.loaded);

              let totalUploaded = 0;
              for (const [_, bytes] of fileProgresses.entries()) {
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
                reject(new Error("Upload failed."));
              }
            });

            request.addEventListener("error", () => reject(new Error("Upload failed.")));
            request.open("PUT", signed.uploadUrl);
            request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            request.send(file);
          });

          // 3. Complete the upload
          await fetchJson(`/api/rooms/${roomId}/uploads`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              objectKey: signed.objectKey,
              fileName: relativePath,
              contentType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              uploadId: group.type === "folder" ? group.id : undefined,
              folderName: group.type === "folder" ? group.name : undefined,
            }),
          });
        })
      );

      // Mark upload group as complete
      setUploads((prev) =>
        prev.map((u) =>
          u.id === group.id
            ? { ...u, status: "complete", progress: 100, uploadedBytes: totalBytes }
            : u,
        ),
      );

      // Auto-hide the successful item after a brief delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== group.id));
      }, 700);

    } catch (error) {
      const wasAborted = activeRequests.some(xhr => xhr.readyState === 0 || xhr.status === 0);
      if (wasAborted) return; // Silent cleanup if user cancelled

      setUploads((prev) =>
        prev.map((u) =>
          u.id === group.id
            ? { ...u, status: "error", error: error instanceof Error ? error.message : "Upload failed" }
            : u,
        ),
      );
      toast.error(`Upload failed for ${group.name}`);
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

  async function handleDownload(fileId: string) {
    try {
      const data = await fetchJson<{ url: string }>(`/api/files/${fileId}/download`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download file.");
    }
  }

  async function handleDownloadFolder(uploadId: string) {
    try {
      window.open(`/api/folders/${uploadId}/download`, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download folder.");
    }
  }

  async function handleRenameSubmit() {
    if (!renameTarget) return;

    try {
      await renameFileAction(renameTarget.id, { fileName: renameValue });
      onFileRename(renameTarget.id, renameValue);
      setRenameTarget(null);
      toast.success("File renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename file.");
    }
  }

  async function handleRenameFolderSubmit() {
    if (!renameFolderTarget) return;

    try {
      await renameFolderAction(renameFolderTarget.uploadId, { name: renameFolderValue });
      onFolderRename(renameFolderTarget.uploadId, renameFolderValue);
      setRenameFolderTarget(null);
      toast.success("Folder renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename folder.");
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await deleteFileAction(fileId);
      onFileDelete(fileId);
      toast.success("File deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete file.");
    }
  }

  async function handleDeleteFolder(uploadId: string) {
    try {
      await deleteFolderAction(uploadId);
      onFolderDelete(uploadId);
      toast.success("Folder deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete folder.");
    }
  }

  const groupedItems = groupFilesAndFolders(files);

  return (
    <div className="flex flex-col h-full gap-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handlePickerChange}
      />
      <input
        type="file"
        multiple
        className="hidden"
        ref={(node) => {
          folderInputRef.current = node;
        }}
        onChange={handlePickerChange}
      />

      {/* Modern SaaS Upload Dropzone */}
      <motion.div
        className="relative flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current -= 1;
          if (dragDepthRef.current <= 0) {
            setIsDragging(false);
            dragDepthRef.current = 0;
          }
        }}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? "var(--primary)" : "rgba(115, 115, 115, 0.3)",
          backgroundColor: isDragging ? "var(--accent)" : "rgba(0, 0, 0, 0)",
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        whileHover={{ scale: 0.995 }}
      >
        <motion.div
          animate={{ y: isDragging ? -4 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3"
        >
          <Upload className="h-5 w-5" />
        </motion.div>
        
        <p className="text-sm font-medium text-foreground">
          Drag & drop your files here, or{" "}
          <span className="text-primary hover:underline font-semibold">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports multiple files or directories
        </p>

        <div className="mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Files
          </Button>
          <Button variant="secondary" size="xs" onClick={() => folderInputRef.current?.click()}>
            <FolderUp className="h-3.5 w-3.5" />
            Folder
          </Button>
        </div>
      </motion.div>

      {/* Uploading progress states */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Uploading
            </h3>
            <div className="space-y-1.5">
              {uploads.map((upload) => (
                <motion.div
                  key={upload.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="truncate font-medium text-foreground flex-1">{upload.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">
                        {upload.status === "complete"
                          ? "Uploaded"
                          : upload.status === "error"
                            ? "Failed"
                            : `${upload.progress}%`}
                      </span>
                      {upload.status === "error" && (
                        <button
                          onClick={() => handleRetryUpload(upload.id)}
                          className="text-blue-500 hover:text-blue-600 transition-colors p-0.5 rounded"
                          title="Retry"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => cancelUpload(upload.id)}
                        className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 rounded"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {upload.status === "error" ? (
                    <p className="text-[10px] text-destructive truncate">{upload.error}</p>
                  ) : (
                    <Progress value={upload.progress} className="h-1 bg-muted [&>div]:bg-primary transition-all duration-200" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Recent Files List */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 select-none">
          Recent uploads
        </h3>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {groupedItems.length === 0 ? (
            <div className="rounded-xl border border-border border-dashed py-12 text-center flex flex-col items-center justify-center">
              <File className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">No files in this room yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Uploaded files appear here for everyone</p>
            </div>
          ) : (
            <Files className="w-full p-0 bg-transparent space-y-2 border-none">
              {groupedItems.map((item) => {
                if (item.type === "file") {
                  const { file } = item;
                  const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
                  const Icon = FileIconMap[ext] || File;

                  const ThumbnailIcon = () => (
                    <Image
                      src={file.thumbnailUrl!}
                      alt={file.fileName}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded object-cover border border-border"
                    />
                  );

                  return (
                    <AnimateFileItem
                      key={file.id}
                      icon={file.thumbnailUrl ? ThumbnailIcon : Icon}
                      className="group border border-border/40 rounded-xl p-3 hover:border-neutral-300 dark:hover:border-neutral-800 transition-colors pointer-events-auto bg-card"
                    >
                      <div className="flex items-center justify-between w-full pointer-events-auto">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground leading-none">{file.fileName}</p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground leading-none">
                              {formatFileSize(file.sizeBytes)} • {formatRelativeTime(new Date(file.uploadedAt))}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                          <Button variant="ghost" size="icon-xs" className="cursor-pointer" onClick={() => handleDownload(file.id)} title="Download file">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="cursor-pointer"
                            onClick={() => {
                              setRenameTarget(file);
                              setRenameValue(file.fileName);
                            }}
                            title="Rename file"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="hover:text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10 cursor-pointer"
                            onClick={() => handleDelete(file.id)}
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </AnimateFileItem>
                  );
                } else {
                  const folder = item;
                  const tree = buildTree(folder.files);

                  return (
                    <AnimateFolderItem
                      key={folder.uploadId}
                      value={folder.uploadId}
                      className="border border-border/40 rounded-xl bg-card transition-colors hover:border-neutral-300 dark:hover:border-neutral-800"
                    >
                      <AnimateFolderTrigger className="p-3 w-full cursor-pointer pointer-events-auto">
                        <div className="flex items-center justify-between w-full pointer-events-auto">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground leading-none">{folder.name}</p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground leading-none">
                              {folder.files.length} {folder.files.length === 1 ? "file" : "files"} ({formatFileSize(folder.sizeBytes)}) • {formatRelativeTime(new Date(folder.uploadedAt))}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon-xs" className="cursor-pointer" onClick={() => handleDownloadFolder(folder.uploadId)} title="Download folder (ZIP)">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="cursor-pointer"
                              onClick={() => {
                                setRenameFolderTarget(folder);
                                setRenameFolderValue(folder.name);
                              }}
                              title="Rename folder"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="hover:text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10 cursor-pointer"
                              onClick={() => handleDeleteFolder(folder.uploadId)}
                              title="Delete folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </AnimateFolderTrigger>
                      <AnimateFolderContent className="bg-muted/10 dark:bg-muted/5 py-2 px-1 border-t border-border/20 rounded-b-xl">
                        <FolderTree
                          nodes={tree}
                          uploadId={folder.uploadId}
                          onFileDownload={handleDownload}
                          onFileRename={(file) => {
                            setRenameTarget(file);
                            setRenameValue(file.fileName);
                          }}
                          onFileDelete={handleDelete}
                        />
                      </AnimateFolderContent>
                    </AnimateFolderItem>
                  );
                }
              })}
            </Files>
          )}
        </div>
      </div>

      {/* File Rename Dialog */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="rounded-lg max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Rename file</DialogTitle>
          </DialogHeader>
          <Input 
            value={renameValue} 
            onChange={(event) => setRenameValue(event.target.value)} 
            className="h-8 text-sm mt-2"
          />
          <DialogFooter className="mt-4 gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRenameSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Rename Dialog */}
      <Dialog open={Boolean(renameFolderTarget)} onOpenChange={(open) => !open && setRenameFolderTarget(null)}>
        <DialogContent className="rounded-lg max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Rename folder</DialogTitle>
          </DialogHeader>
          <Input 
            value={renameFolderValue} 
            onChange={(event) => setRenameFolderValue(event.target.value)} 
            className="h-8 text-sm mt-2"
          />
          <DialogFooter className="mt-4 gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setRenameFolderTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRenameFolderSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Recursive Tree Node Renderer
function FolderTree({
  nodes,
  uploadId,
  onFileDownload,
  onFileRename,
  onFileDelete,
}: {
  nodes: Record<string, TreeNode>;
  uploadId: string;
  onFileDownload: (fileId: string) => void;
  onFileRename: (file: RoomFile) => void;
  onFileDelete: (fileId: string) => void;
}) {
  const sortedNodeNames = Object.keys(nodes).sort((a, b) => {
    const nodeA = nodes[a];
    const nodeB = nodes[b];
    if (nodeA.type !== nodeB.type) {
      return nodeA.type === "directory" ? -1 : 1;
    }
    return a.localeCompare(b);
  });

  return (
    <AnimateSubFiles className="p-0 space-y-0.5 bg-transparent border-none">
      {sortedNodeNames.map((name) => {
        const node = nodes[name];
        const isDir = node.type === "directory";
        const pathKey = `${uploadId}/${node.relativePath}`;

        if (isDir) {
          return (
            <AnimateFolderItem key={pathKey} value={pathKey} className="border-none bg-transparent">
              <AnimateFolderTrigger className="p-2 w-full cursor-pointer hover:bg-muted/40 rounded-lg">
                <span className="text-xs font-semibold text-foreground/80">{node.name}</span>
              </AnimateFolderTrigger>
              <AnimateFolderContent className="bg-transparent pl-4 border-l border-border/60 ml-3 py-1">
                <FolderTree
                  nodes={node.children}
                  uploadId={uploadId}
                  onFileDownload={onFileDownload}
                  onFileRename={onFileRename}
                  onFileDelete={onFileDelete}
                />
              </AnimateFolderContent>
            </AnimateFolderItem>
          );
        } else {
          const file = node.file!;
          const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
          const Icon = FileIconMap[ext] || File;

          const ThumbnailIcon = () => (
            <Image
              src={file.thumbnailUrl!}
              alt={file.fileName}
              width={18}
              height={18}
              className="h-4.5 w-4.5 rounded object-cover border border-border"
            />
          );

          return (
            <AnimateFileItem
              key={file.id}
              icon={file.thumbnailUrl ? ThumbnailIcon : Icon}
              className="group p-2 cursor-default hover:bg-muted/40 rounded-lg"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate leading-none text-xs font-medium text-foreground">{node.name}</span>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 font-normal">
                    ({formatFileSize(file.sizeBytes)})
                  </span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity ml-2">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-5 w-5 [&_svg]:size-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDownload(file.id);
                    }}
                    title="Download file"
                  >
                    <Download />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-5 w-5 [&_svg]:size-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileRename(file);
                    }}
                    title="Rename file"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-5 w-5 hover:text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10 [&_svg]:size-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDelete(file.id);
                    }}
                    title="Delete file"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </AnimateFileItem>
          );
        }
      })}
    </AnimateSubFiles>
  );
}
