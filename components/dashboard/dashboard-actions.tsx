"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Field,
  FieldError,
} from "@/components/ui/field";
import {
  createRoomSchema,
  joinRoomSchema,
  type CreateRoomInput,
  type JoinRoomInput,
} from "@/lib/validators";
import { Spinner } from "../ui/spinner";

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

  const createForm = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      roomName: "",
    },
    mode: "onBlur",
  });

  const joinForm = useForm<JoinRoomInput>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      roomCode: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const handleCreateRoom = async (data: CreateRoomInput) => {
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

  const handleJoinRoom = async (data: JoinRoomInput) => {
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 my-8 sm:mt-16 sm:mb-10">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-xl font-medium tracking-tight">Rooms Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Manage and access your shared spaces
        </p>
      </div>
      <div className="flex shrink gap-2.5">
        {/* Create Room Dialog / Limit Tooltip */}
        {isRoomsFull ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className="inline-flex w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md cursor-not-allowed"
                >
                  <Button
                    disabled
                    className="w-auto pointer-events-none"
                  >
                    <Plus className="size-4" />
                    Create Room
                  </Button>
                </span>
              }
            />
            <TooltipContent
              side="bottom"
              className="bg-destructive text-destructive-foreground border-destructive max-w-xs p-2.5"
              arrowClassName="bg-destructive fill-destructive"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Room limit reached</p>
                  <p className="text-xs mt-0.5">
                    Delete a room to create a new one.
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button className="w-full flex-1 sm:w-auto">
                  <Plus className="size-4" />
                  Create Room
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new room</DialogTitle>
                <DialogDescription>
                  Rooms let you instantly sync text and files.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={createForm.handleSubmit((data) =>
                  handleCreateRoom(data)
                )}
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

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isCreating}
                    onClick={() => {
                      setCreateOpen(false);
                      createForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Spinner />
                        Creating
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Join Room Dialog */}
        <Dialog open={joinOpen} onOpenChange={(open) => {
          if (isJoining) return;
          setJoinOpen(open);
        }}>
          <DialogTrigger render={
            <Button variant="secondary" className="w-full flex-1 sm:w-auto">
              <Key className="size-4" />
              Join Room
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Join a room
              </DialogTitle>
              <DialogDescription>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isJoining}
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
                  {isJoining ? (
                    <>
                      <Spinner />
                      Joining
                    </>
                  ) : (
                    <>
                      <Key className="size-4" />
                      Join
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}