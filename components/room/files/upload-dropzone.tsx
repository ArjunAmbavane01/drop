"use client";

import type { ChangeEvent, ClipboardEvent, RefObject } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Clipboard, FolderUp, Upload } from "lucide-react";

interface UploadDropzoneProps {
  isDragging: boolean;
  isProcessing: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onPickerChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onClipboardPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onClipboardUpload: () => void;
}

export function UploadDropzone({
  isDragging,
  isProcessing,
  fileInputRef,
  folderInputRef,
  onPickerChange,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onClipboardPaste,
  onClipboardUpload,
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
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-4 sm:p-6 md:p-7 text-center cursor-pointer transition-colors hover:border-foreground/30"
        onClick={() => {
          if (!isProcessing) fileInputRef.current?.click();
        }}
        onPaste={(e) => {
          if (!isProcessing) onClipboardPaste(e);
        }}
        tabIndex={0}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          if (!isProcessing) onDrop(e);
        }}
        animate={{
          borderColor: isDragging ? "var(--primary)" : undefined,
          backgroundColor: isDragging ? "var(--accent)" : undefined,
        }}
      >
        {isProcessing ? (
          <>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground animate-pulse">
              <Upload className="size-4 animate-bounce" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              Processing files...
            </p>
            <p className="text-xs text-muted-foreground">
              This might take a moment for large folders.
            </p>
          </>
        ) : (
          <>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Upload className="size-4" />
            </div>

            <p className="text-xs sm:text-sm font-medium text-foreground">
              Drag & drop your files here, or{" "}
              <span className="text-primary hover:underline font-semibold">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Supports multiple files or directories
            </p>

            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderUp />
                Upload folder
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClipboardUpload}
              >
                <Clipboard />
                From clipboard
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
