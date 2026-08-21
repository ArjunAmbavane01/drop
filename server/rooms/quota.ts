import { getDb } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { LIMITS } from "@/lib/limits";
import { getUploadRateLimiter } from "@/lib/ratelimit";
import { isExcludedPath } from "@/lib/exclusions";

export async function getUserStorageUsage(userId: string): Promise<number> {
  const [result] = await getDb()
    .select({ total: sql<number>`COALESCE(SUM(${uploadedFiles.sizeBytes}), 0)` })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.uploaderId, userId));
  return Number(result?.total ?? 0);
}

export async function getRoomStorageUsage(roomId: string): Promise<number> {
  const [result] = await getDb()
    .select({ total: sql<number>`COALESCE(SUM(${uploadedFiles.sizeBytes}), 0)` })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));
  return Number(result?.total ?? 0);
}

export async function validateUploadQuota(
  userId: string,
  roomId: string,
  rawFiles: { name: string; size: number }[]
) {
  // 0. Exclude files/folders based on exclusions first
  const files = rawFiles.filter((f) => !isExcludedPath(f.name));

  // If no files to upload, return early
  if (files.length === 0) {
    return;
  }

  // 1. Total file count check
  if (files.length > LIMITS.MAX_FILES_PER_UPLOAD) {
    throw new Error("too-many-files");
  }

  // 2. Validate structural and path limits
  const filePaths = new Set<string>();
  const dirPaths = new Set<string>();

  for (const file of files) {
    const path = file.name;

    // A. Path length check
    if (path.length > LIMITS.MAX_PATH_LENGTH) {
      throw new Error(`path-too-long:${path}`);
    }

    // B. Invalid path/traversal checks
    const segments = path.split("/").filter((s) => s !== "");
    
    if (
      path.includes("..") ||
      path.includes("\\") ||
      path.startsWith("/") ||
      path.split("/").some((s) => s === "" || s === "." || s === "..")
    ) {
      throw new Error(`invalid-path:${path}`);
    }

    // C. Filename length check
    const filename = segments[segments.length - 1];
    if (!filename || filename.length > LIMITS.MAX_FILENAME_LENGTH) {
      throw new Error(`filename-too-long:${path}`);
    }

    // D. Folder depth check
    const depth = segments.length - 1;
    if (depth > LIMITS.MAX_FOLDER_DEPTH) {
      throw new Error(`folder-depth-exceeded:${path}`);
    }

    // E. Individual file size check
    if (file.size > LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(`file-too-large:${path}`);
    }

    // F. Duplicate paths check
    if (filePaths.has(path)) {
      throw new Error(`duplicate-path:${path}`);
    }
    filePaths.add(path);

    // Track all ancestor directories of this file for conflicting path check
    for (let i = 1; i < segments.length; i++) {
      const dirPath = segments.slice(0, i).join("/");
      dirPaths.add(dirPath);
    }
  }

  // G. Conflicting paths check (a path cannot be both a file and a directory)
  for (const file of files) {
    if (dirPaths.has(file.name)) {
      throw new Error(`conflicting-path:${file.name}`);
    }
  }

  // 3. Room quota check
  const aggregateSize = files.reduce((sum, f) => sum + f.size, 0);
  const roomUsage = await getRoomStorageUsage(roomId);
  if (roomUsage + aggregateSize > LIMITS.MAX_STORAGE_PER_ROOM_BYTES) {
    throw new Error("room-quota-exceeded");
  }

  // 4. User quota check
  const userUsage = await getUserStorageUsage(userId);
  if (userUsage + aggregateSize > LIMITS.MAX_STORAGE_PER_USER_BYTES) {
    throw new Error("user-quota-exceeded");
  }

  // 5. Rate limit: 1 event per upload session (not per file!)
  const rateLimiter = getUploadRateLimiter();
  const rateLimitResult = await rateLimiter.limit(userId);
  if (!rateLimitResult.success) {
    throw new Error("upload-rate-limit-exceeded");
  }
}
