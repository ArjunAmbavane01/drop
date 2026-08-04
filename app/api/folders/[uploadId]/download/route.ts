import { eq } from "drizzle-orm";
import { PassThrough } from "stream";

import { getDb } from "@/db";
import { uploads } from "@/db/schema";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { listObjectsWithPrefix, getObjectStream } from "@/server/r2/files";
import { jsonError } from "@/lib/http";

const archiver = require("archiver");


export async function GET(
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

    const prefix = `${upload.roomId}/${uploadId}/`;
    const keys = await listObjectsWithPrefix(prefix);

    if (keys.length === 0) {
      return jsonError("No files found in folder.", 404);
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    // Run async archiving in the background, drawing streams from R2 and pushing them into the zip
    (async () => {
      try {
        for (const key of keys) {
          const relativePath = key.substring(prefix.length);
          const fileStream = await getObjectStream(key);
          archive.append(fileStream, { name: relativePath });
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    const safeFolderName = upload.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "folder";

    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFolderName}.zip"`,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to download folder.",
    );
  }
}
