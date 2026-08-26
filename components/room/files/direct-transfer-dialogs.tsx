"use client";

import { useState } from "react";
import { Check, Monitor, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DirectDevice } from "@/lib/direct-transfer/types";

export function DirectConnectDialog({ open, devices, error, onOpenChange, onConnect }: { open: boolean; devices: DirectDevice[]; error: string | null; onOpenChange: (open: boolean) => void; onConnect: (device: DirectDevice) => void }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Direct connect</DialogTitle>
          <DialogDescription>
            Choose an available device to send files directly. These files are not persisted to Drop or R2 and are only available on the receiving device after transfer.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600">
            There is a problem with the direct-transfer backend, so direct transfer is unavailable right now.
          </p>
        )}
        <div className="space-y-1">
          {devices.length === 0 ? (
            <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">No other devices are currently available.</p>
          ) : devices.map((device) => (
            <button key={device.deviceId} type="button" onClick={() => setSelectedDeviceId(device.deviceId)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedDeviceId === device.deviceId ? "bg-accent text-foreground" : "hover:bg-muted/60"}`}>
              <Monitor className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{device.name}</span>
              {selectedDeviceId === device.deviceId && <Check className="size-4 text-emerald-600" />}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selectedDevice} onClick={() => { if (selectedDevice) { onConnect(selectedDevice); onOpenChange(false); } }}>Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IncomingDirectRequestDialog({ request, onAccept, onDecline }: { request: { from: DirectDevice } | null; onAccept: () => void; onDecline: () => void }) {
  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Incoming direct connection</DialogTitle>
          <DialogDescription>{request?.from.name} wants to connect and send files directly to this device.</DialogDescription>
        </DialogHeader>
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">Files sent over this connection are not persisted to Drop or R2.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onDecline}><X />Decline</Button>
          <Button onClick={onAccept}><Check />Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
