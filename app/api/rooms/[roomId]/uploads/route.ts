import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { uploads, uploadedFiles } from "@/db/schema";
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
    
    // For folder uploads, prefix with the shared uploadId.
    // Otherwise, use the original random UUID prefix.
    const objectKey = input.uploadId
      ? `${roomId}/${input.uploadId}/${input.fileName}`
      : `${roomId}/${crypto.randomUUID()}-${input.fileName}`;

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

    // If part of a folder upload, ensure the parent Upload record exists in the DB
    if (input.uploadId) {
      const [existingUpload] = await getDb()
        .select()
        .from(uploads)
        .where(eq(uploads.id, input.uploadId))
        .limit(1);

      if (!existingUpload) {
        await getDb()
          .insert(uploads)
          .values({
            id: input.uploadId,
            roomId,
            uploaderId: session.user.id,
            name: input.folderName || "Untitled Folder",
          });
      }
    }

    const [file] = await getDb()
      .insert(uploadedFiles)
      .values({
        roomId,
        uploaderId: session.user.id,
        uploadId: input.uploadId || null,
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
        uploadId: file.uploadId,
        uploadName: input.uploadId ? (input.folderName || "Untitled Folder") : null,
      },
    });

    return jsonOk({ fileId: file.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to finish upload.");
  }
}

