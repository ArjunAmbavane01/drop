"use client";

import Link from "next/link";
import { ArrowLeft, Trash2, DoorOpen } from "lucide-react";

import type { RoomMember, RoomSnapshot } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/room/theme-toggle";
import { RoomCodeCopy } from "@/components/ui/room-code-copy";
import { ElasticStack } from "@/components/ui/elastic-stack";
import { getAvatarDataUri } from "@/lib/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RoomHeader({
  room,
  members,
  currentUser,
  isOwner,
  onLeave,
  onClearRoom,
  onlineUserIds = [],
}: {
  room: RoomSnapshot["room"];
  members: RoomMember[];
  currentUser: RoomMember;
  isOwner: boolean;
  onLeave: () => void;
  onClearRoom: () => void;
  onlineUserIds?: string[];
}) {
  const stackItems = members.map((member) => ({
    id: member.id,
    name: member.name,
    image: getAvatarDataUri(member.id),
    isOnline: onlineUserIds.includes(member.id),
  }));

  return (
    <header className="flex items-center justify-between gap-4 pb-4">
      {/* Left side: Back button & Room Details */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to rooms</span>
          <span className="sm:hidden">Back</span>
        </Link>

        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground sm:text-base truncate">
            {room.name}
          </h1>
          <div className="shrink-0">
            <RoomCodeCopy code={room.roomCode} />
          </div>
        </div>
      </div>

      {/* Right side: Participants, Theme toggle & Clear/Leave room */}
      <div className="flex items-center gap-3 shrink-0">
        {/* ElasticStack Participants */}
        <div className="flex items-center gap-2">
          <ElasticStack items={stackItems} itemSize={24} overlap={6} pushForce={4} />
          <span className="text-xs text-muted-foreground font-medium hidden md:inline-block">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        <div className="h-3.5 w-px bg-border hidden sm:block" />

        <ThemeToggle />

        {isOwner ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 font-medium transition-colors cursor-pointer"
                  title="Clear room"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear room</span>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-xl max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-sm font-semibold">Clear this room?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  This permanently deletes all uploaded files and clears the shared text for everyone in this room.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-1.5">
                <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearRoom}
                  className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            onClick={onLeave}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 font-medium transition-colors cursor-pointer"
            title="Leave room"
          >
            <DoorOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Leave room</span>
          </Button>
        )}
      </div>
    </header>
  );
}
