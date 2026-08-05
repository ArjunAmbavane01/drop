"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FolderOpen,
  Key,
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  DoorOpen
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/room/theme-toggle";
import { UserMenu } from "@/components/room/user-menu";
import { fetchJson } from "@/lib/fetcher";
import { DashboardActions } from "./dashboard-actions";

export interface Room {
  id: string;
  name: string;
  roomCode: string;
  ownerId: string;
  createdAt: string | Date;
}

export function DashboardScreen({
  initialMyRooms,
  initialJoinedRooms,
  currentUser,
}: {
  initialMyRooms: Room[];
  initialJoinedRooms: Room[];
  currentUser: { id: string; name: string; email: string; image: string | null };
}) {
  const router = useRouter();
  const [myRooms, setMyRooms] = useState<Room[]>(initialMyRooms);
  const [joinedRooms, setJoinedRooms] = useState<Room[]>(initialJoinedRooms);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");

  // Rename states
  const [renameOpen, setRenameOpen] = useState(false);
  const [roomToRename, setRoomToRename] = useState<Room | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  async function handleCreateRoom(name: string) {
    if (myRooms.length >= 5) {
      toast.error("You have reached the maximum limit of 5 rooms. A room must be deleted before creating another.");
      return;
    }
    setIsCreating(true);
    try {
      const data = await fetchJson<{ roomId: string }>("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      toast.success("Room created.");
      router.push(`/rooms/${data.roomId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinRoom(code: string) {
    setIsJoining(true);
    try {
      const data = await fetchJson<{ roomId: string }>("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: joinRoomCode }),
      });
      toast.success("Room joined.");
      router.push(`/rooms/${data.roomId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to join room.");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleRenameRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomToRename) return;
    setIsRenaming(true);
    try {
      await fetchJson(`/api/rooms/${roomToRename.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
      toast.success("Room renamed.");
      setMyRooms((prev) =>
        prev.map((r) => (r.id === roomToRename.id ? { ...r, name: renameValue } : r))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename room.");
    } finally {
      setIsRenaming(false);
      setRenameOpen(false);
      setRoomToRename(null);
      setRenameValue("");
    }
  }

  async function handleDeleteRoom(roomId: string) {
    try {
      await fetchJson(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });
      toast.success("Room deleted.");
      setMyRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete room.");
    }
  }

  async function handleLeaveRoom(roomId: string) {
    try {
      await fetchJson(`/api/rooms/${roomId}/membership`, {
        method: "DELETE",
      });
      toast.success("Left the room.");
      setJoinedRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to leave room.");
    }
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Room code copied to clipboard.");
  };

  return (
    <div className="min-h-screen bg-background w-full">
      <div className="flex flex-col mx-auto max-w-5xl w-full py-8 px-5">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Drop</h1>
              <p className="text-sm text-muted-foreground">Private cross-device transfer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={currentUser} />
          </div>
        </header>

        <DashboardActions
          roomCount={myRooms.length}
          maxRooms={5}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isCreating={isCreating}
          isJoining={isJoining}
        />

        <div className="space-y-12 mt-8">
          {/* My Rooms List */}
          <section>
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                My Rooms ({myRooms.length}/5)
              </h3>
            </div>
            {myRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 italic">You haven&apos;t created any rooms yet.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {myRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between py-4 group hover:bg-muted/30 px-3 -mx-3 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <Link href={`/rooms/${room.id}`} className="block">
                        <span className="text-sm font-medium hover:underline text-foreground">
                          {room.name}
                        </span>
                      </Link>
                      <span className="inline-block mt-1 text-xs font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {room.roomCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/rooms/${room.id}`} passHref>
                        <Button variant="ghost" size="xs" className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5 cursor-pointer">
                          Open
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                          <DropdownMenuItem
                            render={
                              <Link href={`/rooms/${room.id}`} className="flex items-center w-full">
                                <FolderOpen className="mr-2 h-3.5 w-3.5" />
                                Open
                              </Link>
                            }
                          />
                          <DropdownMenuItem onClick={() => handleCopyCode(room.roomCode)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRoomToRename(room);
                              setRenameValue(room.name);
                              setRenameOpen(true);
                            }}
                          >
                            <Edit2 className="mr-2 h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete room "${room.name}"? This cannot be undone.`)) {
                                handleDeleteRoom(room.id);
                              }
                            }}
                            className="text-destructive focus:text-destructive focus:bg-destructive/5 dark:focus:bg-destructive/10"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Joined Rooms List */}
          <section>
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Joined Rooms ({joinedRooms.length})
              </h3>
            </div>
            {joinedRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 italic">You haven&apos;t joined any other rooms yet.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {joinedRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between py-4 group hover:bg-muted/30 px-3 -mx-3 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <Link href={`/rooms/${room.id}`} className="block">
                        <span className="text-sm font-medium hover:underline text-foreground">
                          {room.name}
                        </span>
                      </Link>
                      <span className="inline-block mt-1 text-xs font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {room.roomCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/rooms/${room.id}`} passHref>
                        <Button variant="ghost" size="xs" className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5 cursor-pointer">
                          Open
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                          <DropdownMenuItem
                            render={
                              <Link href={`/rooms/${room.id}`} className="flex items-center w-full">
                                <FolderOpen className="mr-2 h-3.5 w-3.5" />
                                Open
                              </Link>
                            }
                          />
                          <DropdownMenuItem onClick={() => handleCopyCode(room.roomCode)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Are you sure you want to leave room "${room.name}"?`)) {
                                handleLeaveRoom(room.id);
                              }
                            }}
                            className="text-destructive focus:text-destructive focus:bg-destructive/5 dark:focus:bg-destructive/10"
                          >
                            <DoorOpen className="mr-2 h-3.5 w-3.5" />
                            Leave Room
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleRenameRoom}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Rename room</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter a new name for your room.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="rename-name" className="text-xs">Room Name</Label>
              <Input
                id="rename-name"
                required
                placeholder="e.g. My Laptop Sync"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={() => {
                  setRenameOpen(false);
                  setRoomToRename(null);
                  setRenameValue("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-9 text-xs" disabled={isRenaming}>
                {isRenaming ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
