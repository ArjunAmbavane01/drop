import { getDb } from "@/db";
import { files } from "@/db/schema";
import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { completeUploadSchema, createUploadSchema } from "@/lib/validators";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { createSignedUploadUrl, getObjectMetadata } from "@/server/r2/files";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);

    const json = await request.json();
    const input = createUploadSchema.parse(json);
    const objectKey = `${roomId}/${crypto.randomUUID()}-${input.fileName}`;
    const uploadUrl = await createSignedUploadUrl(objectKey, input.contentType);

    return jsonOk({
      objectKey,
      uploadUrl,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to create upload URL.",
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);

    const json = await request.json();
    const input = completeUploadSchema.parse(json);
    const objectMetadata = await getObjectMetadata(input.objectKey);

    if (objectMetadata.sizeBytes !== input.sizeBytes) {
      return jsonError("Uploaded object could not be verified.", 409);
    }

    const [file] = await getDb()
      .insert(files)
      .values({
        roomId,
        uploaderId: session.user.id,
        objectKey: input.objectKey,
        fileName: input.fileName,
        contentType: objectMetadata.contentType ?? input.contentType,
        sizeBytes: objectMetadata.sizeBytes,
      })
      .returning();

    await createRoomEvent(roomId, "file.created", {
      file: {
        id: file.id,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        objectKey: file.objectKey,
        uploadedAt: file.uploadedAt.toISOString(),
        uploader: {
          id: session.user.id,
          name: session.user.name,
        },
        thumbnailUrl: file.contentType?.startsWith("image/")
          ? `${env.r2PublicBaseUrl}/${file.objectKey}`
          : null,
      },
    });

    return jsonOk({ fileId: file.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to finish upload.");
  }
}
