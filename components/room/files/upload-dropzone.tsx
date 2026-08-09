"use client";

import type { ChangeEvent, RefObject } from "react";
import { FolderUp, Upload } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onPickerChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function UploadDropzone({
  isDragging,
  fileInputRef,
  folderInputRef,
  onPickerChange,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
}: UploadDropzoneProps) {
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPickerChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPickerChange}
      />

      <motion.div
        className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 sm:p-7 text-center cursor-pointer transition-colors hover:border-foreground/30 bg-card/20 dark:bg-card/10"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        animate={{
          borderColor: isDragging ? "var(--primary)" : undefined,
          backgroundColor: isDragging ? "var(--accent)" : undefined,
        }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-2.5">
          <Upload className="h-4 w-4" />
        </div>

        <p className="text-xs sm:text-sm font-medium text-foreground">
          Drag & drop your files here, or{" "}
          <span className="text-primary hover:underline font-semibold">browse</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Supports multiple files or directories
        </p>

        <div className="mt-3.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload files
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => folderInputRef.current?.click()}
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <FolderUp className="h-3.5 w-3.5" />
            Upload folder
          </Button>
        </div>
      </motion.div>
    </>
  );
}
