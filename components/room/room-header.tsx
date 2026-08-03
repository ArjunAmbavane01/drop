"use client";

import { Copy, DoorOpen } from "lucide-react";
import { toast } from "sonner";

import type { RoomMember, RoomSnapshot } from "@/types/rooms";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/room/theme-toggle";
import { UserMenu } from "@/components/room/user-menu";

export function RoomHeader({
  room,
  members,
  currentUser,
  isOwner,
  onLeave,
}: {
  room: RoomSnapshot["room"];
  members: RoomMember[];
  currentUser: RoomMember;
  isOwner: boolean;
  onLeave: () => void;
}) {
  async function handleCopyCode() {
    await navigator.clipboard.writeText(room.roomCode);
    toast.success("Room code copied.");
  }

  return (
    <header className="flex items-center justify-between border-b border-border pb-4">
      {/* Left side: Room Details */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {room.name}
        </h1>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={handleCopyCode}
          className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Click to copy room code"
        >
          <span>{room.roomCode}</span>
          <Copy className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      </div>

      {/* Right side: Participants & Actions */}
      <div className="flex items-center gap-4">
        {/* Compact Participants indicator */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {members.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={member.image ?? undefined} alt={member.name} />
                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-semibold font-sans">
                  {member.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        <div className="h-4 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu user={currentUser} />
          {!isOwner && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onLeave}
              className="text-muted-foreground hover:text-destructive animate-none"
              title="Leave Room"
            >
              <DoorOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
