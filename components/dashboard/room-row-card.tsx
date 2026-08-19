"use client";

import { motion } from "motion/react";
import { Room } from "@/types/rooms";
import { ReactNode } from "react";
import { RoomCodeCopy } from "../ui/room-code-copy";

interface RoomRowCardProps {
  room: Room;
  onClick: () => void;
  actions?: ReactNode;
  subtitle?: ReactNode;
}

export function RoomRowCard({
  room,
  onClick,
  actions,
  subtitle,
}: RoomRowCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onClick={onClick}
      className="group grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 sm:gap-8 items-center justify-between p-3 dark:hover:bg-muted/30 hover:bg-muted transition-colors duration-300 cursor-pointer rounded-sm"
    >
      {/* Room Name */}
      <div className="min-w-0">
        <h4 className="font-medium text-foreground truncate">
          {room.name}
        </h4>
      </div>

      {/* Subtitle — hidden on small screens */}
      <div className="text-sm text-muted-foreground whitespace-nowrap hidden sm:block">
        {subtitle}
      </div>

      {/* Room Code */}
      <div onClick={(e) => e.stopPropagation()}>
        <RoomCodeCopy code={room.roomCode} />
      </div>

      {/* Actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1"
      >
        {actions}
      </div>
    </motion.div>
  );
}