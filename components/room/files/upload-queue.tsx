"use client";

import { Folder, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UploadState } from "./types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";
import { FileIcon } from "../file-icons";
import { Spinner } from "@/components/ui/spinner";

function getUploadMetadata(upload: UploadState) {
  const parts: string[] = [];
  if (upload.totalBytes > 0) parts.push(formatFileSize(upload.totalBytes));
  if (upload.fileCount) {
    parts.push(`${upload.fileCount.toLocaleString()} ${upload.type === "folder" ? "files" : "file"}`);
  }
  return parts.join(" · ");
}

interface UploadQueueProps {
  uploads: UploadState[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  title?: string;
}

export function UploadQueue({ uploads, onRetry, onCancel, title = "Uploading" }: UploadQueueProps) {
  return (
    <AnimatePresence>
      {uploads.length > 0 && (
        <div className="space-y-2 shrink-0 flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none shrink-0">
            {title} ({uploads.length})
          </h3>
          <ScrollArea
            className={cn(
              "max-h-40 sm:max-h-48 w-full pb-2 sm:pb-3",
              uploads.length <= 3 && "**:data-[slot=scroll-area-scrollbar]:hidden"
            )}
          >
            <div className="space-y-1.5 pr-3 sm:pr-4 pb-0.5">
              {uploads.map((upload) => (
                <motion.div
                  key={upload.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border/60 bg-card/40 dark:bg-card/20 px-2 sm:px-3.5 py-2 text-xs"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex justify-center items-center size-6 text-muted-foreground">
                      {upload.type === "folder"
                        ? <Folder className="size-4" />
                        : <FileIcon fileName={upload.name} className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {upload.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {getUploadMetadata(upload)}
                      </p>
                    </div>
                  </div>

                  <div className="w-16 sm:w-24 md:w-32 shrink-0">
                    {upload.status === "error" ? (
                      <p className="text-xs text-destructive truncate">
                        {upload.error || "Upload failed"}
                      </p>
                    ) : upload.status === "preparing" ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Spinner className="size-3.5" />
                        <span className="hidden sm:inline">Preparing</span>
                      </div>
                    ) : (
                      <Progress value={upload.progress} className="w-full" />
                    )}
                  </div>

                  {(upload.status !== "preparing") && (
                    <span className="text-muted-foreground tabular-nums shrink-0 text-right">
                      {upload.status === "complete"
                        ? "100%"
                        : upload.status === "error"
                          ? "Failed"
                          : `${upload.progress}%`}
                    </span>
                  )}

                  <div className="flex items-center shrink-0">
                    {upload.status === "error" && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              onClick={() => onRetry(upload.id)}
                              variant={"secondary"}
                              size={"icon-sm"}
                              aria-label="Retry"
                            >
                              <RefreshCw className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>Retry</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={"ghost"}
                            size={"icon-sm"}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1 sm:mr-0"
                            onClick={() => onCancel(upload.id)}
                            aria-label="Cancel"
                          >
                            <X className="size-3.5" />
                          </Button>
                        }
                      />
                      <TooltipContent>Cancel</TooltipContent>
                    </Tooltip>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </AnimatePresence>
  );
}
