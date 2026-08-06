"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import { createRoomSchema } from "@/lib/validators";
import { Room } from "@/types/rooms";

type RenameFormData = z.infer<typeof createRoomSchema>;

interface RenameRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  onRename: (newName: string) => Promise<void>;
  isRenaming: boolean;
}

export function RenameRoomDialog({
  open,
  onOpenChange,
  room,
  onRename,
  isRenaming,
}: RenameRoomDialogProps) {
  const { control, handleSubmit, reset } = useForm<RenameFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      roomName: "",
    },
  });

  useEffect(() => {
    if (room) {
      reset({ roomName: room.name });
    }
  }, [room, reset]);

  const onSubmit = async (data: RenameFormData) => {
    await onRename(data.roomName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Rename room
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a new name for your room.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="rename-name" className="text-xs">
              Room Name
            </Label>
            <Controller
              name="roomName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Input
                    {...field}
                    id="rename-name"
                    placeholder="e.g. My Laptop Sync"
                    className="h-10 rounded-xl"
                    disabled={isRenaming}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 text-xs"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-9 text-xs" disabled={isRenaming}>
              {isRenaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
