import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/db";
import { roomEvents } from "@/db/schema";
import type { RoomEvent, RoomMember } from "@/types/rooms";

type EventPayload = Record<string, unknown>;

export async function createRoomEvent(
  roomId: string,
  type: RoomEvent["type"],
  payload: EventPayload,
) {
  await getDb().insert(roomEvents).values({
    roomId,
    type,
    payload,
  });
}

export async function getRoomEvents(roomId: string, afterId: number) {
  const events = await getDb()
    .select()
    .from(roomEvents)
    .where(and(eq(roomEvents.roomId, roomId), gt(roomEvents.id, afterId)))
    .orderBy(roomEvents.id);

  return events as RoomEvent[];
}

export function buildMemberPayload(member: RoomMember) {
  return { member };
}
