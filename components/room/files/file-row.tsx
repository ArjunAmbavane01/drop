"use client";

import { EncryptedImage } from "./encrypted-image";
import { Download, Pencil, Trash2 } from "lucide-react";
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
import { FileItem as AnimateFileItem } from "@/components/animate-ui/components/radix/files";
import { FileIcon } from "../file-icons";
import { cn } from "@/lib/utils";

interface FileRowProps {
  file: RoomFile;
  onDownload: (fileId: string) => void;
  onRename: (file: RoomFile) => void;
  onDelete: (fileId: string) => void;
  isDeleting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (fileId: string, isShift: boolean) => void;
}

export function FileRow({
  file,
  onDownload,
  onRename,
  onDelete,
  isDeleting,
  isSelected = false,
  onToggleSelect,
}: FileRowProps) {
  const ItemIcon = () => (
    <div
      className="size-8 flex items-center justify-center relative select-none shrink-0"
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
          className="size-4.5 bg-background shadow-xs"
        />
      </div>

      {/* Thumbnail or File Icon (hidden when selected or on hover) */}
      <div
        className={cn(
          "flex items-center justify-center transition-opacity",
          isSelected ? "opacity-0" : "group-hover/file-item:opacity-0"
        )}
      >
        {file.thumbnailUrl ? (
          <EncryptedImage
            file={file}
            width={32}
            height={32}
            className="size-8 rounded object-cover border border-border/60"
          />
        ) : (
          <FileIcon
            fileName={file.fileName}
            className="size-5 text-muted-foreground"
          />
        )}
      </div>
    </div>
  );

  return (
    <AnimateFileItem
      icon={ItemIcon}
      className={cn("w-full transition-colors cursor-pointer")}
    >
      <div
        className="flex items-center justify-between w-full min-w-0 pointer-events-auto gap-3 cursor-pointer select-none"
        onClick={(e) => {
          if (onToggleSelect) onToggleSelect(file.id, e.shiftKey);
        }}
      >
        <div className="space-y-0.5 min-w-0 flex-1 pb-0.5">
          <p className="truncate text-sm font-medium text-foreground leading-normal" title={file.fileName}>{file.fileName}</p>
          <p className="text-xs text-muted-foreground leading-normal">
            {formatFileSize(file.sizeBytes)} • {formatRelativeTime(new Date(file.uploadedAt))}
          </p>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onDownload(file.id)}
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
                  onClick={() => onRename(file)}
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
                  onClick={() => onDelete(file.id)}
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
}
