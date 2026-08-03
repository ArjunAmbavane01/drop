import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { files } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { createSignedDownloadUrl } from "@/server/r2/files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const session = await requireRequestSession();
    const [file] = await getDb().select().from(files).where(eq(files.id, fileId)).limit(1);

    if (!file) {
      return jsonError("File not found.", 404);
    }

    await requireRoomAccess(file.roomId, session.user.id);

    const url = await createSignedDownloadUrl(file.objectKey);

    return jsonOk({ url });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to create download URL.",
    );
  }
}
