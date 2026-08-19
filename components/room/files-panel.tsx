"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MAX_BULK_SELECTION } from "@/lib/constants";
import {
  deleteFileAction,
  deleteFilesAction,
  deleteFolderAction,
  deleteFoldersAction,
  getFileDownloadUrlAction,
  renameFileAction,
  renameFolderAction,
  refreshRoomFilesAction,
} from "@/server/rooms/actions";
import type { RoomFile } from "@/types/rooms";
import { Files } from "@/components/animate-ui/components/radix/files";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  onFilesRefresh: (files: RoomFile[]) => void;
  onFileRename: (fileId: string, fileName: string) => void;
  onFileDelete: (fileId: string) => void;
  onFolderRename: (uploadId: string, name: string) => void;
  onFolderDelete: (uploadId: string) => void;
  onBulkDelete?: (deletedFileIds: string[], deletedFolderIds: string[]) => void;
  onRestoreFiles?: (files: RoomFile[]) => void;
}

export function FilesPanel({
  roomId,
  files,
  onFilesRefresh,
  onFileRename,
  onFileDelete,
  onFolderRename,
  onFolderDelete,
  onBulkDelete,
  onRestoreFiles,
}: FilesPanelProps) {
  const [renameTarget, setRenameTarget] = useState<RoomFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set());
  const [deletingFolderIds, setDeletingFolderIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
  const currentItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of groupedItems) {
      if (item.type === "file") {
        ids.add(item.file.id);
      } else {
        ids.add(item.uploadId);
        for (const file of item.files) {
          ids.add(file.id);
        }
      }
    }
    return ids;
  }, [groupedItems]);

  const topLevelIds = useMemo(
    () => groupedItems.map((item) => (item.type === "file" ? item.file.id : item.uploadId)),
    [groupedItems]
  );

  const isAllSelected =
    topLevelIds.length > 0 && topLevelIds.every((id) => selectedIds.has(id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of previous) {
        if (currentItemIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });

    setLastSelectedId((previous) =>
      previous && currentItemIds.has(previous) ? previous : null,
    );
  }, [currentItemIds]);

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
      setLastSelectedId(null);
    } else {
      if (topLevelIds.length > MAX_BULK_SELECTION) {
        toast.warning(`You can select up to ${MAX_BULK_SELECTION} items at once. Selecting the first ${MAX_BULK_SELECTION}.`);
        setSelectedIds(new Set(topLevelIds.slice(0, MAX_BULK_SELECTION)));
      } else {
        setSelectedIds(new Set(topLevelIds));
      }
    }
  }

  function handleToggleSelect(id: string, isShift: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (
        isShift &&
        lastSelectedId &&
        topLevelIds.includes(lastSelectedId) &&
        topLevelIds.includes(id)
      ) {
        const fromIndex = topLevelIds.indexOf(lastSelectedId);
        const toIndex = topLevelIds.indexOf(id);
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        const rangeIds = topLevelIds.slice(start, end + 1);

        const shouldSelect = !prev.has(id);
        for (const rId of rangeIds) {
          if (shouldSelect) {
            if (next.size >= MAX_BULK_SELECTION) {
              toast.warning(`Selection limit reached (${MAX_BULK_SELECTION} items max).`);
              break;
            }
            next.add(rId);
          } else {
            next.delete(rId);
          }
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (next.size >= MAX_BULK_SELECTION) {
            toast.warning(`You can select up to ${MAX_BULK_SELECTION} items at once.`);
            return prev;
          }
          next.add(id);
        }
      }
      return next;
    });
    setLastSelectedId(id);
  }

  async function handleBulkDeleteConfirm() {
    if (selectedIds.size === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    const backupFiles = [...files];
    const backupSelected = new Set(selectedIds);

    const folderUploadIds = Array.from(selectedIds).filter((id) =>
      groupedItems.some((item) => item.type === "folder" && item.uploadId === id)
    );
    const folderSet = new Set(folderUploadIds);
    const fileIds = Array.from(selectedIds).filter((id) =>
      files.some((f) => f.id === id && (!f.uploadId || !folderSet.has(f.uploadId)))
    );

    // Optimistically update UI
    if (onBulkDelete) {
      onBulkDelete(fileIds, folderUploadIds);
    } else {
      for (const fId of fileIds) onFileDelete(fId);
      for (const uId of folderUploadIds) onFolderDelete(uId);
    }

    setSelectedIds(new Set());
    setLastSelectedId(null);
    setIsConfirmOpen(false);

    try {
      await Promise.all([
        fileIds.length > 0 ? deleteFilesAction(fileIds) : Promise.resolve(),
        folderUploadIds.length > 0 ? deleteFoldersAction(folderUploadIds) : Promise.resolve(),
      ]);
      toast.success(`Deleted ${backupSelected.size} ${backupSelected.size === 1 ? "item" : "items"}.`);
    } catch (error) {
      // Revert optimistic update on error
      if (onRestoreFiles) {
        onRestoreFiles(backupFiles);
      }
      setSelectedIds(backupSelected);
      toast.error(error instanceof Error ? error.message : "Failed to delete selected items.");
    } finally {
      setIsBulkDeleting(false);
    }
  }

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

  async function handleRefreshFiles() {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const { files: refreshedFiles } = await refreshRoomFilesAction(roomId);
      onFilesRefresh(refreshedFiles);
      toast.success("Files refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh files.");
    } finally {
      setIsRefreshing(false);
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(uploadId);
      return next;
    });
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
    <div className="flex flex-col gap-4 sm:gap-5 flex-1 h-full min-h-0">
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

      {/* Uploaded Files List */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2 select-none shrink-0 min-h-7">
          <div className="flex items-center gap-2">
            {groupedItems.length > 0 && (
              <Checkbox
                checked={isAllSelected}
                indeterminate={isSomeSelected}
                onCheckedChange={handleToggleSelectAll}
                aria-label="Select all files"
                className="size-4 cursor-pointer"
              />
            )}
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Files ({groupedItems.length})
            </h3>
            {selectedIds.size > 0 && (
              <span className="text-xs text-primary font-medium">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedIds.size > 0 && (
              <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={isBulkDeleting}
                    >
                      {isBulkDeleting ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      <span>Delete ({selectedIds.size})</span>
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedIds.size} selected {selectedIds.size === 1 ? "item" : "items"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {selectedIds.size} selected {selectedIds.size === 1 ? "item" : "files and folders"}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDeleteConfirm}
                      variant="destructive"
                      disabled={isBulkDeleting}
                    >
                      {isBulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} ${selectedIds.size === 1 ? "item" : "items"}`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={handleRefreshFiles}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Spinner className="size-3.5" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {groupedItems.length === 0 ? (
          <EmptyFiles />
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="pt-1 pb-3 pr-3 sm:pr-4 space-y-1">
                <Files className="w-full p-0 bg-transparent space-y-1 border-none shadow-none">
                  {groupedItems.map((item) => {
                    if (item.type === "file") {
                      const isSelected = selectedIds.has(item.file.id);
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
                          isSelected={isSelected}
                          onToggleSelect={handleToggleSelect}
                        />
                      );
                    }

                    const isSelected = selectedIds.has(item.uploadId);
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
                        isSelected={isSelected}
                        onToggleSelect={handleToggleSelect}
                        selectedIds={selectedIds}
                        onToggleFileSelect={handleToggleSelect}
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
