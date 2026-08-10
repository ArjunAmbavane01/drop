"use client";

import { Download, Folder, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderItem as AnimateFolderItem,
  FolderTrigger as AnimateFolderTrigger,
  FolderContent as AnimateFolderContent,
} from "@/components/animate-ui/components/radix/files";
import { FolderIcon as FolderIconPrimitive } from "@/components/animate-ui/primitives/radix/files";
import { buildTree } from "./file-tree-utils";
import { FolderTree } from "./folder-tree";
import type { FolderItem } from "./types";
import { cn } from "@/lib/utils";

interface FolderRowProps {
  folder: FolderItem;
  onDownloadFolder: (uploadId: string) => void;
  onRenameFolder: (folder: FolderItem) => void;
  onDeleteFolder: (uploadId: string) => void;
  onDownloadFile: (fileId: string) => void;
  onRenameFile: (file: RoomFile) => void;
  onDeleteFile: (fileId: string) => void;
  isDeleting?: boolean;
  deletingFileIds?: Set<string>;
  isSelected?: boolean;
  onToggleSelect?: (uploadId: string, isShift: boolean) => void;
  selectedIds?: Set<string>;
  onToggleFileSelect?: (fileId: string, isShift: boolean) => void;
}

export function FolderRow({
  folder,
  onDownloadFolder,
  onRenameFolder,
  onDeleteFolder,
  onDownloadFile,
  onRenameFile,
  onDeleteFile,
  isDeleting,
  deletingFileIds,
  isSelected = false,
  onToggleSelect,
  selectedIds,
  onToggleFileSelect,
}: FolderRowProps) {
  const tree = buildTree(folder.files);

  const FolderItemIcon = (
    <div
      className="size-8 flex items-center justify-center relative select-none shrink-0"
      onClick={(e) => {
        if (onToggleSelect) {
          e.stopPropagation();
          onToggleSelect(folder.uploadId, e.shiftKey);
        }
      }}
    >
      {/* Checkbox (visible on hover or when selected) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity z-10",
          isSelected
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 group-hover/folder-item:opacity-100 pointer-events-none group-hover/folder-item:pointer-events-auto"
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect?.(folder.uploadId, false)}
          aria-label={`Select folder ${folder.name}`}
          className="size-4.5 bg-background shadow-xs"
        />
      </div>

      {/* Folder Icon (hidden when selected or on hover) */}
      <div
        className={cn(
          "flex items-center justify-center transition-opacity",
          isSelected ? "opacity-0" : "group-hover/folder-item:opacity-0"
        )}
      >
        <FolderIconPrimitive
          closeIcon={<Folder className="size-5 text-muted-foreground" />}
          openIcon={<FolderOpen className="size-5 text-muted-foreground" />}
        />
      </div>
    </div>
  );

  return (
    <AnimateFolderItem
      value={folder.uploadId}
      className={cn("rounded-lg border-none transition-colors w-full", isSelected && "bg-muted/50")}
    >
      <AnimateFolderTrigger
        icon={FolderItemIcon}
        className="flex items-center justify-between w-full min-w-0 cursor-pointer gap-3"
      >
        <div className="space-y-0.5 min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground leading-snug" title={folder.name}>{folder.name}</p>
          <p className="text-xs text-muted-foreground leading-normal">
            {folder.files.length} {folder.files.length === 1 ? "file" : "files"} ({formatFileSize(folder.sizeBytes)}) • {formatRelativeTime(new Date(folder.uploadedAt))}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onDownloadFolder(folder.uploadId)}
                  aria-label="Download"
                >
                  <Download className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onRenameFolder(folder)}
                  aria-label="Rename"
                >
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-50"
                  onClick={() => onDeleteFolder(folder.uploadId)}
                  disabled={isDeleting}
                  aria-label="Delete"
                >
                  {isDeleting ? <Spinner className="size-4 text-destructive" /> : <Trash2 className="size-4" />}
                </Button>
              }
            />
            <TooltipContent>{isDeleting ? "Deleting..." : "Delete"}</TooltipContent>
          </Tooltip>
        </div>
      </AnimateFolderTrigger>
      <AnimateFolderContent className="py-1 pl-2">
        <FolderTree
          nodes={tree}
          uploadId={folder.uploadId}
          onFileDownload={onDownloadFile}
          onFileRename={onRenameFile}
          onFileDelete={onDeleteFile}
          deletingFileIds={deletingFileIds}
          selectedIds={selectedIds}
          onToggleSelect={onToggleFileSelect}
        />
      </AnimateFolderContent>
    </AnimateFolderItem>
  );
}
