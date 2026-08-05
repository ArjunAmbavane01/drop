import { z } from "zod";

import { MAX_TEXT_LENGTH } from "@/lib/constants";

export const createRoomSchema = z.object({
  roomName: z
    .string()
    .min(1, "Room name is required")
    .min(2, "Room name must be at least 2 characters")
    .max(64, "Room name must be less than 50 characters")
    .trim(),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .length(8, "Room code must be exactly 8 characters")
    .regex(/^[A-Z0-9]+$/, "Room code can only contain letters and numbers"),
});

export const updateTextSchema = z.object({
  text: z.string().max(MAX_TEXT_LENGTH),
});

export const createUploadSchema = z.object({
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  uploadId: z.string().uuid().optional().nullable(),
});

export const completeUploadSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(255).nullable(),
  sizeBytes: z.number().int().nonnegative(),
  uploadId: z.string().uuid().optional().nullable(),
  folderName: z.string().trim().min(1).max(260).optional().nullable(),
});

export const renameFileSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1).max(260),
});

