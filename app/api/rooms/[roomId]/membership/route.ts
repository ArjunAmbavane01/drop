import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { roomMemberships, rooms } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { createRoomEvent } from "@/server/rooms/events";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();

    const [room] = await getDb().select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room) {
      return jsonError("Room not found.", 404);
    }

    if (room.ownerId === session.user.id) {
      return jsonError("The room owner cannot leave their own room.", 400);
    }

    await getDb()
      .delete(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, roomId),
          eq(roomMemberships.userId, session.user.id),
        ),
      );

    await createRoomEvent(roomId, "member.left", {
      member: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to leave room.");
  }
}
