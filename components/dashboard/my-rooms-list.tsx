"use client";

import { Room } from "@/types/rooms";
import { formatDistanceToNow } from "date-fns";
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
import { Trash2, Edit2 } from "lucide-react";
import { RoomRowCard } from "./room-row-card";
import { RoomRowList } from "./room-row-list";

interface MyRoomsListProps {
  rooms: Room[];
  onRename: (room: Room) => void;
  onDelete: (roomId: string) => void;
}

export function MyRoomsList({
  rooms,
  onRename,
  onDelete,
}: MyRoomsListProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const handleDeleteClick = (room: Room) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (roomToDelete) {
      onDelete(roomToDelete.id);
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  return (
    <>
      <RoomRowList
        title="My Rooms"
        count={rooms.length}
        groupId="my-rooms-list"
        emptyState={
          <p className="text-sm text-muted-foreground p-3 italic">
            You haven&apos;t created any rooms yet.
          </p>
        }
      >
        {rooms.length > 0
          ? rooms.map((room) => {
            const createdAtText = formatDistanceToNow(
              new Date(room.createdAt),
              { addSuffix: true }
            );

            return (
              <RoomRowCard
                key={room.id}
                room={room}
                onClick={() => router.push(`/rooms/${room.id}`)}
                subtitle={
                  <span className="text-xs text-muted-foreground">
                    {createdAtText}
                  </span>
                }
                actions={
                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      onClick={() => onRename(room)}
                      title="Rename"
                    >
                      <Edit2 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(room)}
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                }
              />
            );
          })
          : null}
      </RoomRowList>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{roomToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}