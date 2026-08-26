"use client";

import { useState } from "react";
import { AlertTriangle, Check, Monitor, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DirectDevice } from "@/lib/direct-transfer/types";
import { cn } from "@/lib/utils";

export function DirectConnectDialog({ open, devices, error, onOpenChange, onConnect }: { open: boolean; devices: DirectDevice[]; error: string | null; onOpenChange: (open: boolean) => void; onConnect: (device: DirectDevice) => void }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Drop Direct</DialogTitle>
          <DialogDescription>
            Send files directly to another device in this room.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-5 text-center">
            <AlertTriangle className="mx-auto mb-2 size-5 text-red-500" />
            <p className="text-sm font-medium text-foreground">
              Drop Direct is temporarily unavailable.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please try again in a moment.
            </p>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-3 rounded-lg border border-amber-500 bg-amber-400/20 px-3 py-2 text-sm text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>Files sent with Drop Direct aren't stored in Drop.</span>
            </p>

            <div className="space-y-1">
              {devices.length === 0 ? (
                <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                  No other devices are currently available.
                </p>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.deviceId}
                    type="button"
                    onClick={() =>
                      setSelectedDeviceId((current) =>
                        current === device.deviceId ? null : device.deviceId
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 border rounded-lg text-left text-foreground text-sm transition-colors cursor-pointer hover:bg-muted/60",
                      selectedDeviceId === device.deviceId && "border-foreground"
                    )}
                  >
                    <Monitor className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{device.name}</span>
                    {selectedDeviceId === device.deviceId && (
                      <Check className="size-4 text-emerald-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {error ? "Close" : "Cancel"}
          </Button>
          <Button disabled={!selectedDevice} onClick={() => { if (selectedDevice) { onConnect(selectedDevice); onOpenChange(false); } }}>
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IncomingDirectRequestDialog({ request, onAccept, onDecline }: { request: { from: DirectDevice } | null; onAccept: () => void; onDecline: () => void }) {
  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Incoming Drop Direct request</DialogTitle>
          <DialogDescription>{request?.from.name} wants to send files directly to this device.</DialogDescription>
        </DialogHeader>
        <p className="flex items-center gap-3 rounded-lg border border-amber-500 bg-amber-400/20 px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          <span>Files sent with Drop Direct aren't stored in Drop.</span>
        </p>
        <DialogFooter>
          <Button variant="destructive" onClick={onDecline}><X />Decline</Button>
          <Button className="bg-emerald-600 bg-none text-white hover:bg-emerald-700" onClick={onAccept}><Check />Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
