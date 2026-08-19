"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { DashboardActions } from "./dashboard-actions";
import { MyRoomsList } from "./my-rooms-list";
import { JoinedRoomsList } from "./joined-rooms-list";
import { RenameRoomDialog } from "./rename-room-dialog";
import { Room } from "@/types/rooms";
import {
  createRoomAction,
  joinRoomAction,
  renameRoomAction,
  deleteRoomAction,
  leaveRoomAction,
} from "@/server/rooms/actions";

interface DashboardScreenProps {
  initialMyRooms: Room[];
  initialJoinedRooms: Room[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export function DashboardScreen({
  initialMyRooms,
  initialJoinedRooms,
  currentUser,
}: DashboardScreenProps) {
  const router = useRouter();
  const [myRooms, setMyRooms] = useState<Room[]>(initialMyRooms);
  const [joinedRooms, setJoinedRooms] = useState<Room[]>(initialJoinedRooms);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Rename states
  const [renameOpen, setRenameOpen] = useState(false);
  const [roomToRename, setRoomToRename] = useState<Room | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  async function handleCreateRoom(name: string) {
    if (myRooms.length >= 5) {
      toast.error(
        "You have reached the maximum limit of 5 rooms. A room must be deleted before creating another."
      );
      return;
    }

    const previousRooms = [...myRooms];
    const tempRoomId = `temp-create-${Date.now()}`;
    const tempRoom: Room = {
      id: tempRoomId,
      name,
      roomCode: "PENDING",
      ownerId: currentUser.id,
      createdAt: new Date(),
    };

    setMyRooms((prev) => [...prev, tempRoom]);
    setIsCreating(true);

    try {
      const result = await createRoomAction({ roomName: name });
      toast.success("Room created.");
      router.push(`/rooms/${result.roomId}`);
      router.refresh();
    } catch (error) {
      setMyRooms(previousRooms);
      toast.error(
        error instanceof Error ? error.message : "Unable to create room."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinRoom(code: string) {
    const previousRooms = [...joinedRooms];
    const tempRoomId = `temp-join-${Date.now()}`;
    const tempRoom: Room = {
      id: tempRoomId,
      name: "Joining Room...",
      roomCode: code.toUpperCase(),
      ownerId: "",
      createdAt: new Date(),
    };

    setJoinedRooms((prev) => [...prev, tempRoom]);
    setIsJoining(true);

    try {
      const result = await joinRoomAction({ roomCode: code });
      toast.success("Room joined.");
      router.push(`/rooms/${result.roomId}`);
      router.refresh();
    } catch (error) {
      setJoinedRooms(previousRooms);
      toast.error(
        error instanceof Error ? error.message : "Unable to join room."
      );
    } finally {
      setIsJoining(false);
    }
  }

  async function handleRenameRoom(newName: string) {
    if (!roomToRename) return;

    const roomId = roomToRename.id;
    const previousRooms = [...myRooms];

    // Optimistically update
    setMyRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, name: newName } : r))
    );
    setIsRenaming(true);

    try {
      await renameRoomAction(roomId, { roomName: newName });
      toast.success("Room renamed.");
      router.refresh();
    } catch (error) {
      setMyRooms(previousRooms);
      toast.error(
        error instanceof Error ? error.message : "Unable to rename room."
      );
    } finally {
      setIsRenaming(false);
      setRoomToRename(null);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    const previousRooms = [...myRooms];

    // Optimistically update
    setMyRooms((prev) => prev.filter((r) => r.id !== roomId));

    try {
      await deleteRoomAction(roomId);
      toast.success("Room deleted.");
      router.refresh();
    } catch (error) {
      setMyRooms(previousRooms);
      toast.error(
        error instanceof Error ? error.message : "Unable to delete room."
      );
    }
  }

  async function handleLeaveRoom(roomId: string) {
    const previousRooms = [...joinedRooms];

    // Optimistically update
    setJoinedRooms((prev) => prev.filter((r) => r.id !== roomId));

    try {
      await leaveRoomAction(roomId);
      toast.success("Left the room.");
      router.refresh();
    } catch (error) {
      setJoinedRooms(previousRooms);
      toast.error(
        error instanceof Error ? error.message : "Unable to leave room."
      );
    }
  }

  return (
    <div className="min-h-screen bg-background w-full">
      <div className="flex flex-col mx-auto max-w-3xl w-full py-5 sm:py-8 px-3 sm:px-5">
        {/* Header */}
        <header className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Drop</h1>
              <p className="text-sm text-muted-foreground">
                Private cross-device transfer
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={currentUser} />
          </div>
        </header>

        <DashboardActions
          roomCount={myRooms.filter((r) => !r.id.startsWith("temp-")).length}
          maxRooms={5}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isCreating={isCreating}
          isJoining={isJoining}
        />

        <div className="space-y-10 sm:space-y-16">
          {/* My Rooms List */}
          <MyRoomsList
            rooms={myRooms}
            onRename={(room) => {
              setRoomToRename(room);
              setRenameOpen(true);
            }}
            onDelete={handleDeleteRoom}
          />

          {/* Joined Rooms List */}
          <JoinedRoomsList
            rooms={joinedRooms}
            onLeave={handleLeaveRoom}
          />
        </div>
      </div>

      {/* Rename Dialog */}
      <RenameRoomDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        room={roomToRename}
        onRename={handleRenameRoom}
        isRenaming={isRenaming}
      />
    </div>
  );
}
