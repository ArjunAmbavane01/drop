"use client";

import Link from "next/link";
import { MoreVertical, Trash2, Edit2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Room } from "@/types/rooms";
import { useState } from "react";
import { RoomCodeCopy } from "../ui/room-code-copy";

interface RoomCardProps {
    room: Room;
    onRename: (room: Room) => void;
    onDelete: (roomId: string) => void;
}

export default function RoomCard({
    room,
    onRename,
    onDelete,
}: RoomCardProps) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleDeleteConfirm = () => {
        onDelete(room.id);
        setIsDeleteDialogOpen(false);
    };

    const createdAtText = formatDistanceToNow(new Date(room.createdAt), {
        addSuffix: true,
    });

    return (
        <>
            <Link href={`/rooms/${room.id}`} className="block h-full">
                <div className="h-full flex flex-col border border-border rounded-lg bg-card p-4 hover:bg-accent/30 transition-colors cursor-pointer group">
                    {/* Header with title and menu */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {room.name}
                            </h3>
                        </div>

                        {/* Dropdown Menu */}
                        <div onClick={(e) => e.preventDefault()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                    <DropdownMenuItem onClick={() => onRename(room)}>
                                        <Edit2 className="mr-2 h-3.5 w-3.5" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/5 dark:focus:bg-destructive/10"
                                    >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Room Code Copy Component */}
                    <div onClick={(e) => e.preventDefault()} className="mb-3">
                        <RoomCodeCopy code={room.roomCode} />
                    </div>

                    {/* Metadata */}
                    <div className="mt-auto text-xs text-muted-foreground">
                        Created {createdAtText}
                    </div>
                </div>
            </Link>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Room</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-medium text-foreground">&quot;{room.name}&quot;</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex justify-end gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}