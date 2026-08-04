import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { uploads } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { renameFolderSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { removeObjectsWithPrefix } from "@/server/r2/files";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  try {
    const { uploadId } = await params;
    const session = await requireRequestSession();
    const json = await request.json();
    const input = renameFolderSchema.parse(json);

    const [upload] = await getDb()
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return jsonError("Folder not found.", 404);
    }

    await requireRoomAccess(upload.roomId, session.user.id);

    await getDb()
      .update(uploads)
      .set({ name: input.name })
      .where(eq(uploads.id, uploadId));

    await createRoomEvent(upload.roomId, "folder.renamed", {
      uploadId,
      name: input.name,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to rename folder.",
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  try {
    const { uploadId } = await params;
    const session = await requireRequestSession();

    const [upload] = await getDb()
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return jsonError("Folder not found.", 404);
    }

    await requireRoomAccess(upload.roomId, session.user.id);

    // Delete all objects under the R2 prefix rooms/{roomId}/{uploadId}/
    const prefix = `${upload.roomId}/${uploadId}/`;
    await removeObjectsWithPrefix(prefix);

    // Delete from DB (cascades to uploadedFiles)
    await getDb()
      .delete(uploads)
      .where(eq(uploads.id, uploadId));

    await createRoomEvent(upload.roomId, "folder.deleted", { uploadId });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to delete folder.",
    );
  }
}
