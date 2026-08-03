import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { roomMemberships, rooms, roomTexts } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { createRoomCode } from "@/lib/utils/room";
import { createRoomSchema, joinRoomSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";
import { createRoomEvent } from "@/server/rooms/events";

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession();
    const json = await request.json();
    const input = createRoomSchema.parse(json);

    const [existingRoom] = await getDb()
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.ownerId, session.user.id))
      .limit(1);

    if (existingRoom) {
      return jsonError("You already own a room.", 409);
    }

    const [room] = await getDb()
      .insert(rooms)
      .values({
        name: input.name,
        roomCode: createRoomCode(),
        ownerId: session.user.id,
      })
      .returning();

    await getDb().insert(roomMemberships).values({
      roomId: room.id,
      userId: session.user.id,
    });

    await getDb().insert(roomTexts).values({
      roomId: room.id,
      text: "",
      updatedByUserId: session.user.id,
    });

    await createRoomEvent(room.id, "member.joined", {
      member: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
    });

    return jsonOk({ roomId: room.id });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to create room.",
      400,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRequestSession();
    const json = await request.json();
    const input = joinRoomSchema.parse(json);

    const [room] = await getDb()
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, input.roomCode.toUpperCase()))
      .limit(1);

    if (!room) {
      return jsonError("Room code not found.", 404);
    }

    const [existing] = await getDb()
      .select()
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      await getDb().insert(roomMemberships).values({
        roomId: room.id,
        userId: session.user.id,
      });
      await createRoomEvent(room.id, "member.joined", {
        member: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        },
      });
    }

    return jsonOk({ roomId: room.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to join room.");
  }
}
