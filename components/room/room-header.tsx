"use client";

import Link from "next/link";
import { ArrowLeft, Trash2, DoorOpen } from "lucide-react";

import type { RoomMember, RoomSnapshot } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { RoomCodeCopy } from "@/components/ui/room-code-copy";
import { ElasticStack } from "@/components/ui/elastic-stack";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useRouter } from "next/navigation";

export function RoomHeader({
  room,
  members,
  isOwner,
  onLeave,
  onClearRoom,
  onlineUserIds = [],
}: {
  room: RoomSnapshot["room"];
  members: RoomMember[];
  isOwner: boolean;
  onLeave: () => void;
  onClearRoom: () => void;
  onlineUserIds?: string[];
}) {
  const router = useRouter();

  const stackItems = members.map((member) => ({
    id: member.id,
    name: member.name,
    image: getAvatarDataUri(member.id),
    isOnline: onlineUserIds.includes(member.id),
  }));

  return (
    <header className="flex items-center justify-between gap-4 pb-4">
      {/* Left side: Back button & Room Details */}
      <div className="flex items-center gap-8">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant={"outline"}
                onClick={() => { router.push("/") }}
                aria-label="Back"
              >
                <ArrowLeft />
              </Button>
            }
          />
          <TooltipContent>Back</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-foreground truncate">
            {room.name}
          </h1>
          <RoomCodeCopy code={room.roomCode} />
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
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Clear room"
                />
              }
            >
              <Trash2 />
              <span className="hidden sm:inline">Clear room</span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this room?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all uploaded files and clears the shared text for everyone in this room.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearRoom}
                  variant={"destructive"}
                >
                  Clear room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Leave room"
          >
            <DoorOpen />
            <span className="hidden sm:inline">Leave room</span>
          </Button>
        )}
      </div>
    </header>
  );
}
