"use client";

import Image from "next/image";
import { Download, File, Pencil, Trash2 } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import {
  FolderItem as AnimateFolderItem,
  FolderTrigger as AnimateFolderTrigger,
  FolderContent as AnimateFolderContent,
  FileItem as AnimateFileItem,
  SubFiles as AnimateSubFiles,
} from "@/components/animate-ui/components/radix/files";
import { FileIconMap } from "../file-icons";
import type { TreeNode } from "./types";

interface FolderTreeProps {
  nodes: Record<string, TreeNode>;
  uploadId: string;
  onFileDownload: (fileId: string) => void;
  onFileRename: (file: RoomFile) => void;
  onFileDelete: (fileId: string) => void;
}

export function FolderTree({
  nodes,
  uploadId,
  onFileDownload,
  onFileRename,
  onFileDelete,
}: FolderTreeProps) {
  const sortedNodeNames = Object.keys(nodes).sort((a, b) => {
    const nodeA = nodes[a];
    const nodeB = nodes[b];
    if (nodeA.type !== nodeB.type) {
      return nodeA.type === "directory" ? -1 : 1;
    }
    return a.localeCompare(b);
  });

  return (
    <AnimateSubFiles className="p-0 space-y-0.5 rounded-lg">
      {sortedNodeNames.map((name) => {
        const node = nodes[name];
        const isDir = node.type === "directory";
        const pathKey = `${uploadId}/${node.relativePath}`;

        if (isDir) {
          return (
            <AnimateFolderItem key={pathKey} value={pathKey}>
              <AnimateFolderTrigger className="p-1 w-full cursor-pointer">
                <span className="text-sm font-medium">{node.name}</span>
              </AnimateFolderTrigger>
              <AnimateFolderContent className="py-1 pl-2">
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
        }

        const file = node.file!;
        const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
        const Icon = FileIconMap[ext] || File;

        const ThumbnailIcon = () => (
          <Image
            src={file.thumbnailUrl!}
            alt={file.fileName}
            width={16}
            height={16}
            className="size-4 rounded object-cover border border-border/60"
          />
        );

        return (
          <AnimateFileItem
            key={file.id}
            icon={file.thumbnailUrl ? ThumbnailIcon : Icon}
            className="group w-full"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate leading-none text-sm font-medium text-foreground">{node.name}</span>
                <span className="text-xs text-muted-foreground/60">
                  ({formatFileSize(file.sizeBytes)})
                </span>
              </div>

              <div className="flex items-center gap-1 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileDownload(file.id);
                  }}
                  title="Download file"
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRename(file);
                  }}
                  title="Rename file"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive hover:bg-destructive/10 cursor-pointer text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileDelete(file.id);
                  }}
                  title="Delete file"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </AnimateFileItem>
        );
      })}
    </AnimateSubFiles>
  );
}
