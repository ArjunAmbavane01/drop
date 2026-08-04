import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { renameFileSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { removeObject } from "@/server/r2/files";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const session = await requireRequestSession();
    const json = await request.json();
    const input = renameFileSchema.parse(json);

    const [file] = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);

    if (!file) {
      return jsonError("File not found.", 404);
    }

    await requireRoomAccess(file.roomId, session.user.id);

    await getDb()
      .update(uploadedFiles)
      .set({ fileName: input.fileName })
      .where(eq(uploadedFiles.id, fileId));

    await createRoomEvent(file.roomId, "file.renamed", {
      fileId,
      fileName: input.fileName,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to rename file.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const session = await requireRequestSession();

    const [file] = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);

    if (!file) {
      return jsonError("File not found.", 404);
    }

    await requireRoomAccess(file.roomId, session.user.id);
    await removeObject(file.objectKey);
    await getDb().delete(uploadedFiles).where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.roomId, file.roomId)));

    await createRoomEvent(file.roomId, "file.deleted", { fileId });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to delete file.");
  }
}

