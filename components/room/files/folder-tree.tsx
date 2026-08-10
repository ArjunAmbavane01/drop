"use client";

import Image from "next/image";
import { Download, File, Pencil, Trash2 } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const nodeEntries = Object.values(nodes);

  return (
    <AnimateSubFiles className="w-full">
      {nodeEntries.map((node) => {
        if (node.type === "directory") {
          return (
            <AnimateFolderItem
              key={node.relativePath}
              value={`${uploadId}-${node.relativePath}`}
              className="rounded-lg border-none transition-colors w-full"
            >
              <AnimateFolderTrigger className="flex items-center justify-between w-full cursor-pointer py-1">
                <span className="truncate leading-none text-sm font-medium text-foreground">{node.name}</span>
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
            width={24}
            height={24}
            className="size-6 rounded object-cover border border-border/60"
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
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileDownload(file.id);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileRename(file);
                        }}
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
                        className="hover:text-destructive hover:bg-destructive/10 cursor-pointer text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileDelete(file.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </AnimateFileItem>
        );
      })}
    </AnimateSubFiles>
  );
}
