import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { uploads, uploadedFiles, roomTexts } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomOwner } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { removeObject } from "@/server/r2/files";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();

    await requireRoomOwner(roomId, session.user.id);

    const roomFiles = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.roomId, roomId));

    await Promise.all(roomFiles.map((file) => removeObject(file.objectKey)));

    await getDb().delete(uploadedFiles).where(eq(uploadedFiles.roomId, roomId));
    await getDb().delete(uploads).where(eq(uploads.roomId, roomId));
    await getDb()
      .update(roomTexts)
      .set({
        text: "",
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(roomTexts.roomId, roomId));

    await createRoomEvent(roomId, "room.cleared", {});

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to clear the room.",
    );
  }
}

