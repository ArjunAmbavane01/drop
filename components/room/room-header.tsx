"use client";

import Link from "next/link";
import { ArrowLeft, Copy, DoorOpen } from "lucide-react";
import { toast } from "sonner";

import type { RoomMember, RoomSnapshot } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/room/theme-toggle";
import { UserMenu } from "@/components/room/user-menu";
import { ElasticStack } from "@/components/ui/elastic-stack";
import { getAvatarDataUri } from "@/lib/avatar";

export function RoomHeader({
  room,
  members,
  currentUser,
  isOwner,
  onLeave,
  onlineUserIds = [],
}: {
  room: RoomSnapshot["room"];
  members: RoomMember[];
  currentUser: RoomMember;
  isOwner: boolean;
  onLeave: () => void;
  onlineUserIds?: string[];
}) {
  async function handleCopyCode() {
    await navigator.clipboard.writeText(room.roomCode);
    toast.success("Room code copied.");
  }

  const stackItems = members.map((member) => ({
    id: member.id,
    name: member.name,
    image: getAvatarDataUri(member.id),
    isOnline: onlineUserIds.includes(member.id),
  }));

  return (
    <header className="flex items-center justify-between border-b border-border pb-4">
      {/* Left side: Room Details */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="group flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-4 w-px bg-border" />
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
        {/* ElasticStack Participants */}
        <div className="flex items-center gap-2">
          <ElasticStack items={stackItems} itemSize={26} overlap={6} pushForce={5} />
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
