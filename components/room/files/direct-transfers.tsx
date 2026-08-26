"use client";

import { useState } from "react";
import { Download, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { FileOrFolderIcon } from "../file-icons";
import type { DirectTransfer } from "@/lib/direct-transfer/types";
import { cn } from "@/lib/utils";

export function DirectTransfers({ received, sent, onDownload, onRetry }: { received: DirectTransfer[]; sent: DirectTransfer[]; onDownload: (transfer: DirectTransfer) => void; onRetry: (transferId: string) => void }) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const transfers = tab === "received" ? received : sent;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">Transfers</h3>
        <div className="flex items-center gap-1 rounded-md bg-muted/50 p-0.5">
          {(["received", "sent"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded px-2 py-1 text-sm capitalize cursor-pointer",
                tab === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {transfers.length === 0 ? (
        <p className="p-5 py-8 text-center text-sm text-foreground bg-muted/50 border border-muted rounded-lg">No files {tab} yet.</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 pr-3">
            {transfers.map((transfer) => <DirectTransferRow key={transfer.id} transfer={transfer} onDownload={onDownload} onRetry={onRetry} />)}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}

function DirectTransferRow({ transfer, onDownload, onRetry }: { transfer: DirectTransfer; onDownload: (transfer: DirectTransfer) => void; onRetry: (transferId: string) => void }) {
  const speed = transfer.speedBytesPerSecond ? ` · ${formatFileSize(transfer.speedBytesPerSecond)}/s` : "";
  const metadata = `${formatFileSize(transfer.totalBytes)} · ${transfer.fileCount} ${transfer.fileCount === 1 ? "file" : "files"}${speed}`;
  const statusClass = transfer.status === "complete" ? "text-emerald-600" : transfer.status === "failed" || transfer.status === "cancelled" ? "text-red-600" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40">
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        <FileOrFolderIcon fileName={transfer.name} type={transfer.type} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{transfer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{metadata} · {formatRelativeTime(new Date(transfer.createdAt))}</p>
      </div>
      <span className={`shrink-0 text-sm ${statusClass}`}>
        {transfer.status === "transferring"
          ? `${Math.round(
            (transfer.transferredBytes / Math.max(transfer.totalBytes, 1)) * 100
          )}%`
          : transfer.direction === "sent"
            ? transfer.status
            : null}
      </span>
      {
        transfer.direction === "received" && transfer.status === "complete" &&
        <Button variant="ghost" size="icon" onClick={() => onDownload(transfer)} aria-label={`Download ${transfer.name}`}>
          <Download />
        </Button>
      }
      {transfer.direction === "sent" && transfer.status === "failed" &&
        <Button variant="ghost" size="icon" onClick={() => onRetry(transfer.id)} aria-label={`Retry sending ${transfer.name}`}>
          <RefreshCw />
        </Button>
      }
    </div>
  );
}
