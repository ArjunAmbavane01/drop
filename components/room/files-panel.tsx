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
      const { url } = await getFileDownloadUrlAction(fileId);
      window.open(url, "_blank", "noopener,noreferrer");
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

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Drag & Drop Upload Dropzone */}
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

      {/* Active Upload Queue */}
      <UploadQueue
        uploads={uploads}
        onRetry={handleRetryUpload}
        onCancel={cancelUpload}
      />

      {/* Recent Uploads List */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 select-none">
          Recent uploads
        </h3>
        <div className="flex-1 overflow-y-auto space-y-1">
          {groupedItems.length === 0 ? (
            <EmptyFiles />
          ) : (
            <Files className="w-full p-0 bg-transparent space-y-1 border-none">
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
                  />
                );
              })}
            </Files>
          )}
        </div>
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
