"use client";

import Image from "next/image";
import { Download, File, Pencil, Trash2 } from "lucide-react";
import { formatFileSize } from "@/lib/format";
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
  FileItem as AnimateFileItem,
  SubFiles as AnimateSubFiles,
} from "@/components/animate-ui/components/radix/files";
import { FileIconMap } from "../file-icons";
import type { TreeNode } from "./types";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  nodes: Record<string, TreeNode>;
  uploadId: string;
  onFileDownload: (fileId: string) => void;
  onFileRename: (file: RoomFile) => void;
  onFileDelete: (fileId: string) => void;
  deletingFileIds?: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, isShift: boolean) => void;
}

export function FolderTree({
  nodes,
  uploadId,
  onFileDownload,
  onFileRename,
  onFileDelete,
  deletingFileIds,
  selectedIds,
  onToggleSelect,
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
              <AnimateFolderTrigger className="flex items-center justify-between w-full min-w-0 cursor-pointer py-1 gap-2">
                <span className="truncate leading-none text-sm font-medium text-foreground min-w-0 flex-1" title={node.name}>{node.name}</span>
              </AnimateFolderTrigger>
              <AnimateFolderContent className="py-1 pl-2">
                <FolderTree
                  nodes={node.children}
                  uploadId={uploadId}
                  onFileDownload={onFileDownload}
                  onFileRename={onFileRename}
                  onFileDelete={onFileDelete}
                  deletingFileIds={deletingFileIds}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                />
              </AnimateFolderContent>
            </AnimateFolderItem>
          );
        }

        const file = node.file!;
        const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
        const Icon = FileIconMap[ext] || File;
        const isDeleting = deletingFileIds?.has(file.id);
        const isSelected = selectedIds?.has(file.id);

        const ItemIcon = () => (
          <div
            className="size-6 flex items-center justify-center relative select-none shrink-0"
            onClick={(e) => {
              if (onToggleSelect) {
                e.stopPropagation();
                onToggleSelect(file.id, e.shiftKey);
              }
            }}
          >
            {/* Checkbox (visible on hover or when selected) */}
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity z-10",
                isSelected
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 group-hover/file-item:opacity-100 pointer-events-none group-hover/file-item:pointer-events-auto"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(file.id, false)}
                aria-label={`Select ${file.fileName}`}
                className="size-3.5 bg-background shadow-xs"
              />
            </div>

            {/* Thumbnail or File Icon */}
            <div
              className={cn(
                "flex items-center justify-center transition-opacity",
                isSelected ? "opacity-0" : "group-hover/file-item:opacity-0"
              )}
              >
                {file.thumbnailUrl ? (
                  <Image
                    src={file.thumbnailUrl}
                    alt={file.fileName}
                    width={24}
                    height={24}
                    className="size-6 rounded object-cover border border-border/60"
                  />
                ) : (
                  <Icon className="size-4 text-muted-foreground" />
                )}
            </div>
          </div>
        );

        return (
          <AnimateFileItem
            key={file.id}
            icon={ItemIcon}
            className={cn("group w-full transition-colors cursor-pointer")}
          >
            <div
              className="flex items-center justify-between w-full min-w-0 gap-2 cursor-pointer select-none"
              onClick={(e) => {
                if (onToggleSelect) {
                  onToggleSelect(file.id, e.shiftKey);
                }
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate leading-none text-sm font-medium text-foreground min-w-0" title={node.name}>{node.name}</span>
                <span className="text-xs text-muted-foreground/60 shrink-0">
                  ({formatFileSize(file.sizeBytes)})
                </span>
              </div>

              <div
                className="flex items-center gap-1 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
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
                        className="hover:text-destructive hover:bg-destructive/10 cursor-pointer text-muted-foreground disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileDelete(file.id);
                        }}
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
            </div>
          </AnimateFileItem>
        );
      })}
    </AnimateSubFiles>
  );
}
