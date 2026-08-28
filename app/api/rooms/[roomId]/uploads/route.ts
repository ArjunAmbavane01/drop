import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

import { jsonError } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { getR2 } from "@/server/r2";
import { env } from "@/lib/env";
import { buildUploadObjectKey } from "@/server/rooms/upload-keys";
import { getRedis } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);

    const fileNameHeader = request.headers.get("x-file-name");
    const contentType = request.headers.get("content-type") || request.headers.get("x-content-type") || "application/octet-stream";
    const sizeBytesHeader = request.headers.get("x-file-size");
    const originalSizeBytesHeader = request.headers.get("x-original-file-size");
    const uploadId = request.headers.get("x-upload-id");

    if (!fileNameHeader) {
      return jsonError("Missing file name.", 400);
    }

    let fileName = "";
    try {
      fileName = decodeURIComponent(fileNameHeader);
    } catch {
      fileName = fileNameHeader;
    }

    if (!request.body) {
      return jsonError("Missing upload body.", 400);
    }

    const sizeBytes = sizeBytesHeader ? Number(sizeBytesHeader) : NaN;
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      return jsonError("Missing file size.", 400);
    }

    // originalSizeBytes is used for upload token validation (token stores original sizes for quota)
    const originalSizeBytes = originalSizeBytesHeader ? Number(originalSizeBytesHeader) : sizeBytes;

    const uploadToken = request.headers.get("x-upload-token");
    if (!uploadToken) {
      return jsonError("Upload token is required.", 400);
    }

    const tokenDataStr = await getRedis().get(`upload-token:${uploadToken}`);
    if (!tokenDataStr) {
      return jsonError("Upload token has expired or is invalid. Please try uploading again.", 400);
    }

    const tokenData = typeof tokenDataStr === "string" ? JSON.parse(tokenDataStr) : tokenDataStr;
    if (tokenData.userId !== session.user.id || tokenData.roomId !== roomId) {
      return jsonError("Unauthorized upload token.", 403);
    }

    const matchingFileIndex = tokenData.files.findIndex((f: { name: string; size: number }) => 
      f.size === originalSizeBytes
    );
    if (matchingFileIndex === -1) {
      return jsonError("Uploaded file size does not match authorization.", 400);
    }

    // Remove the matched file from the list to prevent token reuse
    tokenData.files.splice(matchingFileIndex, 1);
    if (tokenData.files.length > 0) {
      await getRedis().set(`upload-token:${uploadToken}`, JSON.stringify(tokenData), { ex: 120 });
    } else {
      await getRedis().del(`upload-token:${uploadToken}`);
    }

    const objectKey = buildUploadObjectKey(roomId, {
      fileName,
      uploadId: uploadId || undefined,
    });

    const body = Readable.fromWeb(
      request.body as unknown as import("stream/web").ReadableStream<Uint8Array>,
    );
    await getR2().send(
      new PutObjectCommand({
        Bucket: env.r2BucketName,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        ContentLength: sizeBytes,
      }),
    );

    return Response.json({ objectKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload file.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "You do not have access to this room."
          ? 403
          : 500;
    return jsonError(
      message,
      status,
    );
  }
}
