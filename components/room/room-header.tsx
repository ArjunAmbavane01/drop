"use client";

import { ArrowLeft, Trash2, DoorOpen } from "lucide-react";

import type { RoomMember, RoomSnapshot } from "@/types/rooms";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { RoomCodeCopy } from "@/components/ui/room-code-copy";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAvatarDataUri } from "@/lib/avatar";
import { cn } from "@/lib/utils";
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
  currentUserId,
}: {
  room: RoomSnapshot["room"];
  members: RoomMember[];
  isOwner: boolean;
  onLeave: () => void;
  onClearRoom: () => void;
  onlineUserIds?: string[];
  currentUserId?: string;
}) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-4 pb-4 shrink-0">
      {/* Left side: Back button & Room Details */}
      <div className="flex items-center gap-3 sm:gap-8 min-w-0">
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
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="font-semibold text-foreground truncate text-sm sm:text-base">
            {room.name}
          </h1>
          <RoomCodeCopy code={room.roomCode} />
        </div>
      </div>

      {/* Right side: Participants, Theme toggle & Clear/Leave room */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Room Member Avatars */}
        <div className="flex items-center gap-2">
          <AvatarGroup className="-space-x-2">
            {members.map((member) => {
              const isOnline = onlineUserIds.includes(member.id);
              const avatarSrc = getAvatarDataUri(member.id);
              const isCurrentUser = member.id === currentUserId;
              const displayName = isCurrentUser ? "You" : member.name;

              return (
                <Tooltip key={member.id}>
                  <TooltipTrigger
                    render={
                      <div className="inline-flex focus:outline-none">
                        <Avatar
                          className={cn(
                            "size-7 rounded-full border border-primary/60 bg-background transition-opacity cursor-pointer",
                            isOnline ? "opacity-100" : "grayscale opacity-60"
                          )}
                        >
                          <AvatarImage src={avatarSrc} alt={member.name} className="rounded-full bg-background" />
                          <AvatarFallback className="rounded-full text-xs font-medium bg-background">
                            {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    }
                  />
                  <TooltipContent side="top" className="text-xs">
                    {displayName}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </AvatarGroup>
        </div>

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
