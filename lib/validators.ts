import { z } from "zod";

import { MAX_TEXT_LENGTH } from "@/lib/constants";

export const createRoomSchema = z.object({
  name: z.string().trim().min(2).max(64),
});

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().length(8),
});

export const updateTextSchema = z.object({
  text: z.string().max(MAX_TEXT_LENGTH),
});

export const createUploadSchema = z.object({
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
});

export const completeUploadSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(255).nullable(),
  sizeBytes: z.number().int().nonnegative(),
});

export const renameFileSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
});
