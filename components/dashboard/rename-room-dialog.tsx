"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { createRoomSchema, type CreateRoomInput } from "@/lib/validators";
import type { Room } from "@/types/rooms";

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
  const { control, handleSubmit, reset } = useForm<CreateRoomInput>({
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

  const onSubmit = async (data: CreateRoomInput) => {
    await onRename(data.roomName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              Rename room
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Controller
              name="roomName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Input
                    {...field}
                    id="rename-name"
                    placeholder="Enter a new name for your room."
                    disabled={isRenaming}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isRenaming}>
              {isRenaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
