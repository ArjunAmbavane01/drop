"use client";

import { useState } from "react";
import { Download, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { FileOrFolderIcon } from "../file-icons";
import type { DirectTransfer } from "@/lib/direct-transfer/types";

export function DirectTransfers({ received, sent, onDownload }: { received: DirectTransfer[]; sent: DirectTransfer[]; onDownload: (transfer: DirectTransfer) => void }) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const transfers = tab === "received" ? received : sent;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transfers</h3>
        <div className="flex items-center gap-1 rounded-md bg-muted/50 p-0.5">
          {(["received", "sent"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded px-2 py-1 text-[11px] capitalize ${tab === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item}</button>
          ))}
        </div>
      </div>
      {transfers.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No {tab} direct transfers yet.</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 pr-3">
            {transfers.map((transfer) => <DirectTransferRow key={transfer.id} transfer={transfer} onDownload={onDownload} />)}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}

function DirectTransferRow({ transfer, onDownload }: { transfer: DirectTransfer; onDownload: (transfer: DirectTransfer) => void }) {
  const speed = transfer.speedBytesPerSecond ? ` · ${formatFileSize(transfer.speedBytesPerSecond)}/s` : "";
  const metadata = `${formatFileSize(transfer.totalBytes)} · ${transfer.fileCount} ${transfer.fileCount === 1 ? "file" : "files"}${speed}`;
  const statusClass = transfer.status === "complete" ? "text-emerald-600" : transfer.status === "failed" || transfer.status === "cancelled" ? "text-red-600" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40">
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"><FileOrFolderIcon fileName={transfer.name} type={transfer.type} className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{transfer.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{metadata} · <Monitor className="inline size-3" /> {transfer.deviceName} · {formatRelativeTime(new Date(transfer.createdAt))}</p>
      </div>
      <span className={`shrink-0 ${statusClass}`}>
        {transfer.status === "transferring" ? `${Math.round(transfer.transferredBytes / Math.max(transfer.totalBytes, 1) * 100)}%` : transfer.status}
      </span>
      {
        transfer.direction === "received" && transfer.status === "complete" &&
        <Button variant="ghost" size="icon-sm" onClick={() => onDownload(transfer)} aria-label={`Download ${transfer.name}`}>
          <Download className="size-3.5" />
        </Button>
      }
    </div>
  );
}
