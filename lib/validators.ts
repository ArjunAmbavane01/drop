import { z } from "zod";

export const MAX_TEXT_LENGTH = 100_000;

// ==========================================
// Authentication Schemas
// ==========================================

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = signInSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(50, "Name is too long."),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

// ==========================================
// Room Schemas
// ==========================================

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

// ==========================================
// Upload & File Schemas
// ==========================================

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

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type UpdateTextInput = z.infer<typeof updateTextSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type RenameFileInput = z.infer<typeof renameFileSchema>;
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
