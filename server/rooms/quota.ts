import { getDb } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { LIMITS } from "@/lib/limits";
import { getUploadRateLimiter } from "@/lib/ratelimit";

export async function getUserStorageUsage(userId: string): Promise<number> {
  const [result] = await getDb()
    .select({ total: sql<number>`COALESCE(SUM(${uploadedFiles.encryptedSizeBytes}), 0)` })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.uploaderId, userId));
  return Number(result?.total ?? 0);
}

export async function getRoomStorageUsage(roomId: string): Promise<number> {
  const [result] = await getDb()
    .select({ total: sql<number>`COALESCE(SUM(${uploadedFiles.encryptedSizeBytes}), 0)` })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));
  return Number(result?.total ?? 0);
}

export async function validateUploadQuota(
  userId: string,
  roomId: string,
  files: { name: string; size: number }[]
) {
  // 1. Individual file size check
  for (const file of files) {
    if (file.size > LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(`file-too-large:${file.name}`);
    }
  }

  const aggregateSize = files.reduce((sum, f) => sum + f.size, 0);

  // 2. Room quota check
  const roomUsage = await getRoomStorageUsage(roomId);
  if (roomUsage + aggregateSize > LIMITS.MAX_STORAGE_PER_ROOM_BYTES) {
    throw new Error("room-quota-exceeded");
  }

  // 3. User quota check
  const userUsage = await getUserStorageUsage(userId);
  if (userUsage + aggregateSize > LIMITS.MAX_STORAGE_PER_USER_BYTES) {
    throw new Error("user-quota-exceeded");
  }

  // 4. Upload initiation rate limit
  const rateLimiter = getUploadRateLimiter();
  const rateLimitResult = await rateLimiter.limit(userId, { rate: files.length });
  if (!rateLimitResult.success) {
    throw new Error("upload-rate-limit-exceeded");
  }
}
