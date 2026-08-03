"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FolderUp, Pencil, Trash2, Upload, File } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import { fetchJson } from "@/lib/fetcher";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type UploadSignerResponse = { objectKey: string; uploadUrl: string };

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete" | "error";
};

export function FilesPanel({
  roomId,
  files,
  onFileRename,
  onFileDelete,
}: {
  roomId: string;
  files: RoomFile[];
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
}) {
  const [renameTarget, setRenameTarget] = useState<RoomFile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    async function handlePaste(event: ClipboardEvent) {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length === 0) return;
      event.preventDefault();
      await uploadFiles(clipboardFiles);
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

  async function createUpload(file: File, pathName: string, itemId: string) {
    const signed = await fetchJson<UploadSignerResponse>(`/api/rooms/${roomId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: pathName,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });

    await uploadWithProgress(file, signed.uploadUrl, itemId);

    await fetchJson(`/api/rooms/${roomId}/uploads`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectKey: signed.objectKey,
        fileName: pathName,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });
  }

  async function uploadFiles(fileList: File[]) {
    const validFiles = fileList.filter((file) => file.size >= 0);
    if (validFiles.length === 0) return;

    const items = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: getFilePath(file),
      progress: 0,
      status: "uploading" as const,
    }));

    setUploads((previous) => [...items, ...previous].slice(0, 8));

    await Promise.all(
      validFiles.map(async (file, index) => {
        const itemId = items[index].id;
        const pathName = items[index].name;

        try {
          await createUpload(file, pathName, itemId);
          setUploads((previous) =>
            previous.map((item) =>
              item.id === itemId ? { ...item, progress: 100, status: "complete" } : item,
            ),
          );
        } catch (error) {
          setUploads((previous) =>
            previous.map((item) =>
              item.id === itemId ? { ...item, status: "error" } : item,
            ),
          );
          toast.error(error instanceof Error ? error.message : `Upload failed for ${pathName}.`);
        }
      }),
    );
  }

  function uploadWithProgress(file: File, uploadUrl: string, itemId: string) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploads((previous) =>
          previous.map((item) =>
            item.id === itemId ? { ...item, progress } : item,
          ),
        );
      });

      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }
        reject(new Error("Upload failed."));
      });

      request.addEventListener("error", () => reject(new Error("Upload failed.")));
      request.open("PUT", uploadUrl);
      request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      request.send(file);
    });
  }

  function getFilePath(file: File) {
    const relativePath = "webkitRelativePath" in file ? file.webkitRelativePath : "";
    return relativePath || file.name;
  }

  function resetPickers() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  async function handlePickerChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    resetPickers();
    await uploadFiles(nextFiles);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    await uploadFiles(droppedFiles);
  }

  async function handleDownload(fileId: string) {
    try {
      const data = await fetchJson<{ url: string }>(`/api/files/${fileId}/download`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download file.");
    }
  }

  async function handleRenameSubmit() {
    if (!renameTarget) return;

    try {
      await fetchJson(`/api/files/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: renameValue }),
      });
      onFileRename(renameTarget.id, renameValue);
      setRenameTarget(null);
      toast.success("File renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename file.");
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await fetchJson(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      onFileDelete(fileId);
      toast.success("File deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete file.");
    }
  }

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
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="truncate font-medium text-foreground">{upload.name}</p>
                    <span className="text-muted-foreground shrink-0">
                      {upload.status === "complete"
                        ? "Uploaded"
                        : upload.status === "error"
                          ? "Failed"
                          : `${upload.progress}%`}
                    </span>
                  </div>
                  <Progress value={upload.progress} className="h-1 bg-muted [&>div]:bg-primary" />
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
          {files.length === 0 ? (
            <div className="rounded-xl border border-border border-dashed py-12 text-center flex flex-col items-center justify-center">
              <File className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">No files in this room yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Uploaded files appear here for everyone</p>
            </div>
          ) : (
            files.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:border-neutral-300 dark:hover:border-neutral-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {file.thumbnailUrl ? (
                    <Image
                      src={file.thumbnailUrl}
                      alt={file.fileName}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-muted">
                      <File className="h-4 w-4 text-muted-foreground/75" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground leading-none">{file.fileName}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-none">
                      {formatFileSize(file.sizeBytes)} • {formatRelativeTime(new Date(file.uploadedAt))}
                    </p>
                  </div>
                </div>
                
                {/* Desktop Action Buttons directly visible */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDownload(file.id)} title="Download file">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
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
                    onClick={() => handleDelete(file.id)}
                    className="hover:text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10"
                    title="Delete file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

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
    </div>
  );
}
