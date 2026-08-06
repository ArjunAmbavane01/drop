import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { createRoomSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    const json = await request.json();
    const input = createRoomSchema.parse(json);

    // Verify room exists and user is owner
    const [room] = await getDb()
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.ownerId, session.user.id)))
      .limit(1);

    if (!room) {
      return jsonError("Room not found or you are not the owner.", 404);
    }

    await getDb()
      .update(rooms)
      .set({ name: input.roomName, updatedAt: new Date() })
      .where(eq(rooms.id, roomId));

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to rename room."
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();

    // Verify room exists and user is owner
    const [room] = await getDb()
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.ownerId, session.user.id)))
      .limit(1);

    if (!room) {
      return jsonError("Room not found or you are not the owner.", 404);
    }

    await getDb().delete(rooms).where(eq(rooms.id, roomId));

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to delete room."
    );
  }
}
