"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RoomFile } from "@/types/rooms";
import type { FolderItem } from "./types";

interface FileRenameDialogProps {
  target: RoomFile | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function FileRenameDialog({
  target,
  value,
  onChange,
  onClose,
  onSubmit,
}: FileRenameDialogProps) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Rename file</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 text-sm mt-2"
            autoFocus
          />
          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FolderRenameDialogProps {
  target: FolderItem | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function FolderRenameDialog({
  target,
  value,
  onChange,
  onClose,
  onSubmit,
}: FolderRenameDialogProps) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Rename folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 text-sm mt-2"
            autoFocus
          />
          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
