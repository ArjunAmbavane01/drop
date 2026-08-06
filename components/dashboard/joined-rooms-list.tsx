"use client";

import Link from "next/link";
import { Copy, DoorOpen, FolderOpen, MoreVertical } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Room } from "@/types/rooms";

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
  return (
    <section>
      <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Joined Rooms ({rooms.length})
        </h3>
      </div>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 italic">
          You haven&apos;t joined any other rooms yet.
        </p>
      ) : (
        <LayoutGroup id="joined-rooms-group">
          <motion.div layout className="divide-y divide-border/30">
            {rooms.map((room) => {
              const isPending = room.id.startsWith("temp-join-");

              return (
                <motion.div
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="flex items-center justify-between py-4 group hover:bg-muted/30 px-3 -mx-3 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    {isPending ? (
                      <span className="text-sm font-medium text-muted-foreground animate-pulse">
                        {room.name}
                      </span>
                    ) : (
                      <Link href={`/rooms/${room.id}`} className="block">
                        <span className="text-sm font-medium hover:underline text-foreground">
                          {room.name}
                        </span>
                      </Link>
                    )}
                    <span className="inline-block mt-1 text-xs font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded ml-2">
                      {room.roomCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPending && (
                      <>
                        <Link href={`/rooms/${room.id}`} passHref>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5 cursor-pointer"
                          >
                            Open
                          </Button>
                        </Link>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-40 rounded-xl"
                          >
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/rooms/${room.id}`}
                                  className="flex items-center w-full"
                                >
                                  <FolderOpen className="mr-2 h-3.5 w-3.5" />
                                  Open
                                </Link>
                              }
                            />
                            <DropdownMenuItem
                              onClick={() => onCopyCode(room.roomCode)}
                            >
                              <Copy className="mr-2 h-3.5 w-3.5" />
                              Copy Code
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to leave room "${room.name}"?`
                                  )
                                ) {
                                  onLeave(room.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive focus:bg-destructive/5 dark:focus:bg-destructive/10"
                            >
                              <DoorOpen className="mr-2 h-3.5 w-3.5" />
                              Leave Room
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </LayoutGroup>
      )}
    </section>
  );
}
