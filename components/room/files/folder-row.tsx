"use client";

import { Download, Pencil, Trash2 } from "lucide-react";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import {
  FolderItem as AnimateFolderItem,
  FolderTrigger as AnimateFolderTrigger,
  FolderContent as AnimateFolderContent,
} from "@/components/animate-ui/components/radix/files";
import { buildTree } from "./file-tree-utils";
import { FolderTree } from "./folder-tree";
import type { FolderItem } from "./types";

interface FolderRowProps {
  folder: FolderItem;
  onDownloadFolder: (uploadId: string) => void;
  onRenameFolder: (folder: FolderItem) => void;
  onDeleteFolder: (uploadId: string) => void;
  onDownloadFile: (fileId: string) => void;
  onRenameFile: (file: RoomFile) => void;
  onDeleteFile: (fileId: string) => void;
}

export function FolderRow({
  folder,
  onDownloadFolder,
  onRenameFolder,
  onDeleteFolder,
  onDownloadFile,
  onRenameFile,
  onDeleteFile,
}: FolderRowProps) {
  const tree = buildTree(folder.files);

  return (
    <AnimateFolderItem
      value={folder.uploadId}
      className="rounded-lg bg-transparent border-none transition-colors"
    >
      <AnimateFolderTrigger className="p-2.5 w-full cursor-pointer pointer-events-auto hover:bg-muted/50 dark:hover:bg-muted/25 rounded-lg">
        <div className="flex items-center justify-between w-full pointer-events-auto">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground leading-snug">{folder.name}</p>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {folder.files.length} {folder.files.length === 1 ? "file" : "files"} ({formatFileSize(folder.sizeBytes)}) • {formatRelativeTime(new Date(folder.uploadedAt))}
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => onDownloadFolder(folder.uploadId)}
              title="Download folder (ZIP)"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => onRenameFolder(folder)}
              title="Rename folder"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={() => onDeleteFolder(folder.uploadId)}
              title="Delete folder"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </AnimateFolderTrigger>
      <AnimateFolderContent className="bg-transparent py-1 px-1 pl-4 border-l border-border/50 ml-3">
        <FolderTree
          nodes={tree}
          uploadId={folder.uploadId}
          onFileDownload={onDownloadFile}
          onFileRename={onRenameFile}
          onFileDelete={onDeleteFile}
        />
      </AnimateFolderContent>
    </AnimateFolderItem>
  );
}
