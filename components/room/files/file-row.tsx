"use client";

import Image from "next/image";
import { Download, File, Pencil, Trash2 } from "lucide-react";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import type { RoomFile } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { FileItem as AnimateFileItem } from "@/components/animate-ui/components/radix/files";
import { FileIconMap } from "../file-icons";

interface FileRowProps {
  file: RoomFile;
  onDownload: (fileId: string) => void;
  onRename: (file: RoomFile) => void;
  onDelete: (fileId: string) => void;
}

export function FileRow({ file, onDownload, onRename, onDelete }: FileRowProps) {
  const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
  const Icon = FileIconMap[ext] || File;

  const ThumbnailIcon = () => (
    <Image
      src={file.thumbnailUrl!}
      alt={file.fileName}
      width={32}
      height={32}
      className="size-8 rounded object-cover border border-border/60"
    />
  );

  return (
    <AnimateFileItem
      icon={file.thumbnailUrl ? ThumbnailIcon : Icon}
      className="w-full"
    >
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground leading-snug">{file.fileName}</p>
          <p className="text-xs text-muted-foreground leading-normal">
            {formatFileSize(file.sizeBytes)} • {formatRelativeTime(new Date(file.uploadedAt))}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onDownload(file.id)}
            title="Download file"
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onRename(file)}
            title="Rename file"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            onClick={() => onDelete(file.id)}
            title="Delete file"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </AnimateFileItem>
  );
}
