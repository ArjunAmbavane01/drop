"use client";

import { Room } from "@/types/rooms";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Copy, LogOut } from "lucide-react";
import { RoomRowCard } from "./room-row-card";
import { RoomRowList } from "./room-row-list";

interface JoinedRoomsListProps {
  rooms: Room[];
  onCopyCode: (code: string) => void;
  onLeave: (roomId: string) => void;
}

export function JoinedRoomsList({
  rooms,
  onCopyCode,
  onLeave,
}: JoinedRoomsListProps) {
  const router = useRouter();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [roomToLeave, setRoomToLeave] = useState<Room | null>(null);

  const handleLeaveClick = (room: Room) => {
    setRoomToLeave(room);
    setLeaveDialogOpen(true);
  };

  const handleConfirmLeave = () => {
    if (roomToLeave) {
      onLeave(roomToLeave.id);
      setLeaveDialogOpen(false);
      setRoomToLeave(null);
    }
  };

  return (
    <>
      <RoomRowList
        title="Joined Rooms"
        count={rooms.length}
        groupId="joined-rooms-list"
        emptyState={
          <p className="text-sm text-muted-foreground p-3 italic">
            You haven&apos;t joined any rooms yet.
          </p>
        }
        children={
          rooms.length > 0
            ? rooms.map((room) => {
              const isPending = room.id.startsWith("temp-join-");

              return (
                <RoomRowCard
                  key={room.id}
                  room={room}
                  onClick={() => router.push(`/rooms/${room.id}`)}
                  actions={
                    !isPending && (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-8"
                          onClick={() => onCopyCode(room.roomCode)}
                          title="Copy code"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleLeaveClick(room)}
                          title="Leave room"
                        >
                          <LogOut className="size-4" />
                        </Button>
                      </div>
                    )
                  }
                />
              );
            })
            : undefined
        }
      />

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <strong>{roomToLeave?.name}</strong>? You can rejoin later with the room code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}