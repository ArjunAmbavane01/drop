"use client";

import { RefreshCw, X } from "lucide-react";
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

interface UploadQueueProps {
  uploads: UploadState[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export function UploadQueue({ uploads, onRetry, onCancel }: UploadQueueProps) {
  return (
    <AnimatePresence>
      {uploads.length > 0 && (
        <div className="space-y-2 shrink-0 flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none shrink-0">
            Uploading ({uploads.length})
          </h3>
          <ScrollArea
            className={cn(
              "max-h-40 sm:max-h-48 w-full",
              uploads.length <= 3 && "[&_[data-slot=scroll-area-scrollbar]]:hidden"
            )}
          >
            <div className="space-y-1.5 pr-2 pb-0.5">
              {uploads.map((upload) => (
                <motion.div
                  key={upload.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 dark:bg-card/20 px-3.5 py-2 text-xs"
                >
                  <p
                    className="font-medium text-foreground w-[140px] sm:w-[200px] md:w-[240px] shrink-0 truncate"
                    title={upload.name}
                  >
                    {upload.name}
                  </p>

                  <div className="flex-1 min-w-[60px]">
                    {upload.status === "error" ? (
                      <p className="text-[11px] text-destructive truncate">
                        {upload.error || "Upload failed"}
                      </p>
                    ) : (
                      <Progress value={upload.progress} className="w-full" />
                    )}
                  </div>

                  <span className="text-muted-foreground tabular-nums shrink-0 text-right min-w-[36px]">
                    {upload.status === "complete"
                      ? "100%"
                      : upload.status === "error"
                        ? "Failed"
                        : `${upload.progress}%`}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
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
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
