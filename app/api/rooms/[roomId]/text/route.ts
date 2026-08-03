import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { roomTexts } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { updateTextSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);

    const json = await request.json();
    const input = updateTextSchema.parse(json);
    const updatedAt = new Date();

    await getDb()
      .update(roomTexts)
      .set({
        text: input.text,
        updatedByUserId: session.user.id,
        updatedAt,
      })
      .where(eq(roomTexts.roomId, roomId));

    await createRoomEvent(roomId, "text.updated", {
      value: input.text,
      updatedAt: updatedAt.toISOString(),
      updatedByUserId: session.user.id,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to save text.");
  }
}
