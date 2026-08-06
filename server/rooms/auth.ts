import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { roomMemberships, rooms } from "@/db/schema";

export async function requireRoomAccess(roomId: string, userId: string) {
  const [membership] = await getDb()
    .select({ roomId: roomMemberships.roomId })
    .from(roomMemberships)
    .where(
      and(eq(roomMemberships.roomId, roomId), eq(roomMemberships.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    throw new Error("You do not have access to this room.");
  }
}

export async function requireRoomOwner(roomId: string, userId: string) {
  const [room] = await getDb()
    .select({ ownerId: rooms.ownerId })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.ownerId, userId)))
    .limit(1);

  if (!room) {
    throw new Error("Only the room owner can perform this action.");
  }
}