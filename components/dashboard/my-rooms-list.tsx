"use client";

import { LayoutGroup, motion } from "motion/react";
import RoomCard from "./room-card";
import { Room } from "@/types/rooms";

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
  return (
    <section>
      <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My Rooms ({rooms.length}/5)
        </h3>
      </div>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 italic">
          You haven&apos;t created any rooms yet.
        </p>
      ) : (
        <LayoutGroup id="my-rooms-group">
          <motion.div layout className="divide-y divide-border/30">
            {rooms.map((room) => (
              <motion.div
                key={room.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              >
                <RoomCard
                  room={room}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </motion.div>
        </LayoutGroup>
      )}
    </section>
  );
}
