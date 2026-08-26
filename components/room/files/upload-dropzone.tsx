"use client";

import type { ChangeEvent, ClipboardEvent, RefObject } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Clipboard, FolderUp, Upload } from "lucide-react";

interface UploadDropzoneProps {
  mode?: "persistent" | "direct";
  isDragging: boolean;
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
  mode = "persistent",
  isDragging,
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
        onClick={() => fileInputRef.current?.click()}
        onPaste={(e) => {
          onClipboardPaste(e);
        }}
        tabIndex={0}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          onDrop(e);
        }}
        animate={{
          borderColor: isDragging ? "var(--primary)" : undefined,
          backgroundColor: isDragging ? "var(--accent)" : undefined,
        }}
      >
        <>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Upload className="size-4" />
            </div>

            <p className="text-xs sm:text-sm font-medium text-foreground">
              {mode === "direct" ? "Drop files to send directly, or " : "Drag & drop your files here, or "}
              <span className="text-primary hover:underline font-semibold">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === "direct" ? "Files go only to the connected device and are not saved to Drop" : "Supports multiple files or directories"}
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
      </motion.div>
    </>
  );
}
