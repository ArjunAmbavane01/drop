"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Key, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Field,
  FieldError,
} from "@/components/ui/field";
import { createRoomSchema, joinRoomSchema } from "@/lib/validators";

type CreateRoomFormData = z.infer<typeof createRoomSchema>;
type JoinRoomFormData = z.infer<typeof joinRoomSchema>;

interface DashboardActionsProps {
  roomCount: number;
  maxRooms: number;
  onCreateRoom: (name: string) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  isCreating: boolean;
  isJoining: boolean;
}

export function DashboardActions({
  roomCount,
  maxRooms,
  onCreateRoom,
  onJoinRoom,
  isCreating,
  isJoining,
}: DashboardActionsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const createForm = useForm<CreateRoomFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      roomName: "",
    },
    mode: "onBlur",
  });

  const joinForm = useForm<JoinRoomFormData>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      roomCode: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const handleCreateRoom = async (data: CreateRoomFormData) => {
    try {
      await onCreateRoom(data.roomName);
      createForm.reset();
      setCreateOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create room"
      );
    }
  };

  const handleJoinRoom = async (data: JoinRoomFormData) => {
    try {
      await onJoinRoom(data.roomCode);
      joinForm.reset();
      setJoinOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to join room"
      );
    }
  };

  const isRoomsFull = roomCount >= maxRooms;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-16">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-xl font-medium tracking-tight">Rooms Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Manage and access your shared spaces
        </p>
      </div>
      <div className="flex flex-col sm:flex-row shrink gap-2.5">
        {/* Create Room Dialog */}
        <TooltipProvider>
          <Tooltip open={isRoomsFull ? undefined : false}>
            <TooltipTrigger>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger>
                  <Button disabled={isRoomsFull} className="w-full sm:w-auto">
                    <Plus className="size-4" />
                    Create Room
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                      Create a new room
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Rooms let you instantly sync text and files.
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    onSubmit={createForm.handleSubmit((data) => handleCreateRoom(data))}
                    className="space-y-4"
                  >
                    <Controller
                      name="roomName"
                      control={createForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            {...field}
                            id="create-room-name"
                            placeholder="Enter room name"
                            aria-invalid={fieldState.invalid}
                            aria-label="Room Name"
                            disabled={isCreating}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <DialogFooter className="gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setCreateOpen(false);
                          createForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating}
                      >
                        {isCreating ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TooltipTrigger>
            {isRoomsFull && (
              <TooltipContent
                side="bottom"
                className="max-w-xs bg-destructive text-destructive-foreground border-destructive flex items-center gap-2"
                arrowClassName="bg-destructive fill-destructive"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Room limit reached. Delete a room to
                  create a new one.
                </span>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Join Room Dialog */}
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger>
            <Button variant="secondary" className="w-full sm:w-auto">
              <Key className="size-4" />
              Join Room
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Join a room
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Enter the 8-character room code from your other device or teammate.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={joinForm.handleSubmit((data) => handleJoinRoom(data))}
              className="space-y-4"
            >
              <Controller
                name="roomCode"
                control={joinForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      id="join-room-code"
                      placeholder="Enter room code"
                      className="uppercase placeholder:normal-case"
                      maxLength={8}
                      aria-invalid={fieldState.invalid}
                      aria-label="Room Code"
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                      disabled={isJoining}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setJoinOpen(false);
                    joinForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isJoining || !joinForm.formState.isValid}
                >
                  {isJoining ? "Joining..." : "Join"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}