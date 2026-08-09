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
      className="rounded-lg border-none transition-colors w-full"
    >
      <AnimateFolderTrigger className="flex items-center justify-between w-full cursor-pointer">
        <div className="space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground leading-snug">{folder.name}</p>
          <p className="text-xs text-muted-foreground leading-normal">
            {folder.files.length} {folder.files.length === 1 ? "file" : "files"} ({formatFileSize(folder.sizeBytes)}) • {formatRelativeTime(new Date(folder.uploadedAt))}
          </p>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onDownloadFolder(folder.uploadId)}
            title="Download folder (ZIP)"
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onRenameFolder(folder)}
            title="Rename folder"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            onClick={() => onDeleteFolder(folder.uploadId)}
            title="Delete folder"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </AnimateFolderTrigger>
      <AnimateFolderContent className="py-1 pl-2">
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
