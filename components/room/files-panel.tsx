"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  deleteFileAction,
  deleteFolderAction,
  getFileDownloadUrlAction,
  renameFileAction,
  renameFolderAction,
} from "@/server/rooms/actions";
import type { RoomFile } from "@/types/rooms";
import { Files } from "@/components/animate-ui/components/radix/files";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileUpload } from "./files/use-file-upload";
import { groupFilesAndFolders } from "./files/file-tree-utils";
import { UploadDropzone } from "./files/upload-dropzone";
import { UploadQueue } from "./files/upload-queue";
import { EmptyFiles } from "./files/empty-files";
import { FileRow } from "./files/file-row";
import { FolderRow } from "./files/folder-row";
import { FileRenameDialog, FolderRenameDialog } from "./files/rename-dialogs";
import type { FolderItem } from "./files/types";

interface FilesPanelProps {
  roomId: string;
  files: RoomFile[];
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
  onFolderRename: (uploadId: string, name: string) => void;
  onFolderDelete: (uploadId: string) => void;
}

export function FilesPanel({
  roomId,
  files,
  onFileRename,
  onFileDelete,
  onFolderRename,
  onFolderDelete,
}: FilesPanelProps) {
  const [renameTarget, setRenameTarget] = useState<RoomFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set());
  const [deletingFolderIds, setDeletingFolderIds] = useState<Set<string>>(new Set());

  const {
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
  } = useFileUpload(roomId);

  const groupedItems = useMemo(() => groupFilesAndFolders(files), [files]);

  async function handleDownload(fileId: string) {
    try {
      const { url, fileName } = await getFileDownloadUrlAction(fileId);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download file.");
    }
  }

  async function handleDownloadFolder(uploadId: string) {
    try {
      const link = document.createElement("a");
      link.href = `/api/folders/${uploadId}/download`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    setDeletingFileIds((prev) => new Set(prev).add(fileId));
    try {
      await deleteFileAction(fileId);
      onFileDelete(fileId);
      toast.success("File deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete file.");
    } finally {
      setDeletingFileIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  }

  async function handleDeleteFolder(uploadId: string) {
    setDeletingFolderIds((prev) => new Set(prev).add(uploadId));
    try {
      await deleteFolderAction(uploadId);
      onFolderDelete(uploadId);
      toast.success("Folder deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete folder.");
    } finally {
      setDeletingFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col h-full gap-5 min-h-0 h-[55vh] sm:h-[60vh] md:h-[65vh] max-h-[calc(100vh-220px)] min-h-80">
      {/* Drag & Drop Upload Dropzone */}
      <div className="shrink-0">
        <UploadDropzone
          isDragging={isDragging}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          onPickerChange={handlePickerChange}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        />
      </div>

      {/* Active Upload Queue */}
      <UploadQueue
        uploads={uploads}
        onRetry={handleRetryUpload}
        onCancel={cancelUpload}
      />

      {/* Recent Uploads List */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 select-none shrink-0">
          Recent uploads
        </h3>
        {groupedItems.length === 0 ? (
          <EmptyFiles />
        ) : (
          <div className="relative flex-1 min-h-0 overflow-hidden">
            {/* Visual fade overlays */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-background to-transparent z-20" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background to-transparent z-20" />

            <ScrollArea className="h-full w-full">
              <div className="pt-2.5 pb-4 space-y-1">
                <Files className="w-full p-0 bg-transparent space-y-1 border-none shadow-none">
                  {groupedItems.map((item) => {
                  if (item.type === "file") {
                    return (
                      <FileRow
                        key={item.file.id}
                        file={item.file}
                        onDownload={handleDownload}
                        onRename={(file) => {
                          setRenameTarget(file);
                          setRenameValue(file.fileName);
                        }}
                        onDelete={handleDelete}
                        isDeleting={deletingFileIds.has(item.file.id)}
                      />
                    );
                  }

                  return (
                    <FolderRow
                      key={item.uploadId}
                      folder={item}
                      onDownloadFolder={handleDownloadFolder}
                      onRenameFolder={(folder) => {
                        setRenameFolderTarget(folder);
                        setRenameFolderValue(folder.name);
                      }}
                      onDeleteFolder={handleDeleteFolder}
                      onDownloadFile={handleDownload}
                      onRenameFile={(file) => {
                        setRenameTarget(file);
                        setRenameValue(file.fileName);
                      }}
                      onDeleteFile={handleDelete}
                      isDeleting={deletingFolderIds.has(item.uploadId)}
                      deletingFileIds={deletingFileIds}
                    />
                  );
                })}
                </Files>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Rename File Dialog */}
      <FileRenameDialog
        target={renameTarget}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />

      {/* Rename Folder Dialog */}
      <FolderRenameDialog
        target={renameFolderTarget}
        value={renameFolderValue}
        onChange={setRenameFolderValue}
        onClose={() => setRenameFolderTarget(null)}
        onSubmit={handleRenameFolderSubmit}
      />
    </div>
  );
}
