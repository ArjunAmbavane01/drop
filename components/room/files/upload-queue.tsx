"use client";

import { RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import type { UploadState } from "./types";

interface UploadQueueProps {
  uploads: UploadState[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export function UploadQueue({ uploads, onRetry, onCancel }: UploadQueueProps) {
  return (
    <AnimatePresence>
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Uploading
          </h3>
          <div className="space-y-1.5">
            {uploads.map((upload) => (
              <motion.div
                key={upload.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg border border-border/60 bg-card/40 dark:bg-card/20 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="truncate font-medium text-foreground flex-1">{upload.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">
                      {upload.status === "complete"
                        ? "Uploaded"
                        : upload.status === "error"
                          ? "Failed"
                          : `${upload.progress}%`}
                    </span>
                    {upload.status === "error" && (
                      <button
                        onClick={() => onRetry(upload.id)}
                        className="text-primary hover:opacity-80 transition-opacity p-0.5 rounded cursor-pointer"
                        title="Retry"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onCancel(upload.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {upload.status === "error" ? (
                  <p className="text-[11px] text-destructive truncate">{upload.error}</p>
                ) : (
                  <Progress value={upload.progress} className="h-1 bg-muted transition-all duration-200" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
