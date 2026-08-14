"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  users,
  rooms,
  roomMemberships,
  roomTexts,
  uploads,
  uploadedFiles,
} from "@/db/schema";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess, requireRoomOwner } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { createRoomCode } from "@/lib/utils/room";
import {
  createRoomSchema,
  joinRoomSchema,
  updateTextSchema,
  renameFileSchema,
  renameFolderSchema,
  createUploadSchema,
  completeUploadSchema,
  type CreateRoomInput,
  type JoinRoomInput,
  type UpdateTextInput,
  type RenameFileInput,
  type RenameFolderInput,
  type CreateUploadInput,
  type CompleteUploadInput,
} from "@/lib/validators";
import {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  getObjectMetadata,
  removeObject,
  removeObjects,
  removeObjectsWithPrefix,
} from "@/server/r2/files";
import { env } from "@/lib/env";

export async function createRoomAction(input: CreateRoomInput) {
  const session = await requireRequestSession();
  const validatedInput = createRoomSchema.parse(input);

  const ownedRooms = await getDb()
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.ownerId, session.user.id));

  if (ownedRooms.length >= 5) {
    throw new Error(
      "You have reached the maximum limit of 5 rooms. A room must be deleted before creating another."
    );
  }

  const [room] = await getDb()
    .insert(rooms)
    .values({
      name: validatedInput.roomName,
      roomCode: createRoomCode(),
      ownerId: session.user.id,
    })
    .returning();

  await getDb().insert(roomMemberships).values({
    roomId: room.id,
    userId: session.user.id,
  });

  await getDb().insert(roomTexts).values({
    roomId: room.id,
    text: "",
    updatedByUserId: session.user.id,
  });

  await createRoomEvent(room.id, "member.joined", {
    member: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  });

  revalidatePath("/");
  return { roomId: room.id };
}

export async function joinRoomAction(input: JoinRoomInput) {
  const session = await requireRequestSession();
  const validatedInput = joinRoomSchema.parse(input);

  const [room] = await getDb()
    .select()
    .from(rooms)
    .where(eq(rooms.roomCode, validatedInput.roomCode.toUpperCase()))
    .limit(1);

  if (!room) {
    throw new Error("Room code not found.");
  }

  const [existing] = await getDb()
    .select()
    .from(roomMemberships)
    .where(
      and(
        eq(roomMemberships.roomId, room.id),
        eq(roomMemberships.userId, session.user.id)
      )
    )
    .limit(1);

  if (!existing) {
    await getDb().insert(roomMemberships).values({
      roomId: room.id,
      userId: session.user.id,
    });
    await createRoomEvent(room.id, "member.joined", {
      member: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
    });
  }

  revalidatePath("/");
  return { roomId: room.id };
}

export async function renameRoomAction(
  roomId: string,
  input: CreateRoomInput
) {
  const session = await requireRequestSession();
  const validatedInput = createRoomSchema.parse(input);
  await requireRoomOwner(roomId, session.user.id);

  await getDb()
    .update(rooms)
    .set({ name: validatedInput.roomName, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));

  revalidatePath("/");
  revalidatePath(`/rooms/${roomId}`);
  return { success: true };
}

export async function deleteRoomAction(roomId: string) {
  const session = await requireRequestSession();
  await requireRoomOwner(roomId, session.user.id);

  const roomFiles = await getDb()
    .select({ objectKey: uploadedFiles.objectKey })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));

  await removeObjects(roomFiles.map((file) => file.objectKey));

  await getDb().delete(rooms).where(eq(rooms.id, roomId));

  revalidatePath("/");
  return { success: true };
}

export async function deleteAccountAction() {
  const session = await requireRequestSession();
  const userId = session.user.id;

  // 1. Find all rooms owned by the user
  const ownedRooms = await getDb()
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.ownerId, userId));

  const ownedRoomIds = ownedRooms.map((r) => r.id);

  // 2. Find and delete storage files only in rooms owned by the user (which will be deleted)
  if (ownedRoomIds.length > 0) {
    const filesToDelete = await getDb()
      .select({ objectKey: uploadedFiles.objectKey })
      .from(uploadedFiles)
      .where(inArray(uploadedFiles.roomId, ownedRoomIds));

    await removeObjects(filesToDelete.map((file) => file.objectKey));
  }

  // 3. Notify rooms the user joined (that they do not own) that the user left
  const joinedMemberships = await getDb()
    .select({ roomId: roomMemberships.roomId })
    .from(roomMemberships)
    .where(eq(roomMemberships.userId, userId));

  const nonOwnedJoinedRoomIds = joinedMemberships
    .map((m) => m.roomId)
    .filter((roomId) => !ownedRoomIds.includes(roomId));

  await Promise.all(
    nonOwnedJoinedRoomIds.map((roomId) =>
      createRoomEvent(roomId, "member.left", {
        member: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        },
      })
    )
  );

  // 4. Delete user record (cascades to user's rooms, memberships, uploads, uploadedFiles, accounts, sessions)
  await getDb().delete(users).where(eq(users.id, userId));

  revalidatePath("/");
  return { success: true };
}

export async function leaveRoomAction(roomId: string) {
  const session = await requireRequestSession();

  const [room] = await getDb()
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new Error("Room not found.");
  }

  if (room.ownerId === session.user.id) {
    throw new Error("The room owner cannot leave their own room.");
  }

  await getDb()
    .delete(roomMemberships)
    .where(
      and(
        eq(roomMemberships.roomId, roomId),
        eq(roomMemberships.userId, session.user.id)
      )
    );

  await createRoomEvent(roomId, "member.left", {
    member: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function clearRoomAction(roomId: string) {
  const session = await requireRequestSession();
  await requireRoomOwner(roomId, session.user.id);

  const roomFiles = await getDb()
    .select({ objectKey: uploadedFiles.objectKey })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));

  await removeObjects(roomFiles.map((file) => file.objectKey));

  await getDb().delete(uploadedFiles).where(eq(uploadedFiles.roomId, roomId));
  await getDb().delete(uploads).where(eq(uploads.roomId, roomId));
  await getDb()
    .update(roomTexts)
    .set({
      text: "",
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(roomTexts.roomId, roomId));

  await createRoomEvent(roomId, "room.cleared", {});

  revalidatePath(`/rooms/${roomId}`);
  return { success: true };
}

export async function saveTextAction(roomId: string, input: UpdateTextInput) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);

  const validatedInput = updateTextSchema.parse(input);
  const updatedAt = new Date();

  await getDb()
    .update(roomTexts)
    .set({
      text: validatedInput.text,
      updatedByUserId: session.user.id,
      updatedAt,
    })
    .where(eq(roomTexts.roomId, roomId));

  await createRoomEvent(roomId, "text.updated", {
    value: validatedInput.text,
    updatedAt: updatedAt.toISOString(),
    updatedByUserId: session.user.id,
  });

  return { success: true };
}

export async function renameFileAction(
  fileId: string,
  input: RenameFileInput
) {
  const session = await requireRequestSession();
  const validatedInput = renameFileSchema.parse(input);

  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("File not found.");
  }

  await requireRoomAccess(file.roomId, session.user.id);

  await getDb()
    .update(uploadedFiles)
    .set({ fileName: validatedInput.fileName })
    .where(eq(uploadedFiles.id, fileId));

  await createRoomEvent(file.roomId, "file.renamed", {
    fileId,
    fileName: validatedInput.fileName,
  });

  return { success: true };
}

export async function deleteFileAction(fileId: string) {
  const session = await requireRequestSession();

  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("File not found.");
  }

  await requireRoomAccess(file.roomId, session.user.id);
  await removeObject(file.objectKey);
  await getDb()
    .delete(uploadedFiles)
    .where(
      and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.roomId, file.roomId))
    );

  await createRoomEvent(file.roomId, "file.deleted", { fileId });

  return { success: true };
}

export async function deleteFilesAction(fileIds: string[]) {
  if (fileIds.length === 0) return { success: true };
  const session = await requireRequestSession();

  const files = await getDb()
    .select()
    .from(uploadedFiles)
    .where(inArray(uploadedFiles.id, fileIds));

  if (files.length === 0) {
    return { success: true };
  }

  // Authorize for all unique rooms
  const roomIds = Array.from(new Set(files.map((f) => f.roomId)));
  for (const roomId of roomIds) {
    await requireRoomAccess(roomId, session.user.id);
  }

  // Delete from R2
  const objectKeys = files.map((f) => f.objectKey);
  await removeObjects(objectKeys);

  // Delete from DB
  await getDb()
    .delete(uploadedFiles)
    .where(inArray(uploadedFiles.id, files.map((f) => f.id)));

  // Emit room events
  for (const file of files) {
    await createRoomEvent(file.roomId, "file.deleted", { fileId: file.id });
  }

  return { success: true };
}

export async function renameFolderAction(
  uploadId: string,
  input: RenameFolderInput
) {
  const session = await requireRequestSession();
  const validatedInput = renameFolderSchema.parse(input);

  const [upload] = await getDb()
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);

  if (!upload) {
    throw new Error("Folder not found.");
  }

  await requireRoomAccess(upload.roomId, session.user.id);

  await getDb()
    .update(uploads)
    .set({ name: validatedInput.name })
    .where(eq(uploads.id, uploadId));

  await createRoomEvent(upload.roomId, "folder.renamed", {
    uploadId,
    name: validatedInput.name,
  });

  return { success: true };
}

export async function deleteFolderAction(uploadId: string) {
  const session = await requireRequestSession();

  const [upload] = await getDb()
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);

  if (!upload) {
    throw new Error("Folder not found.");
  }

  await requireRoomAccess(upload.roomId, session.user.id);

  const prefix = `${upload.roomId}/${uploadId}/`;
  await removeObjectsWithPrefix(prefix);

  await getDb().delete(uploads).where(eq(uploads.id, uploadId));

  await createRoomEvent(upload.roomId, "folder.deleted", { uploadId });

  return { success: true };
}

export async function deleteFoldersAction(uploadIds: string[]) {
  if (uploadIds.length === 0) return { success: true };
  const session = await requireRequestSession();

  const folderUploads = await getDb()
    .select()
    .from(uploads)
    .where(inArray(uploads.id, uploadIds));

  if (folderUploads.length === 0) {
    return { success: true };
  }

  // Authorize for all unique rooms
  const roomIds = Array.from(new Set(folderUploads.map((u) => u.roomId)));
  for (const roomId of roomIds) {
    await requireRoomAccess(roomId, session.user.id);
  }

  // Remove files for all folders
  for (const upload of folderUploads) {
    const prefix = `${upload.roomId}/${upload.id}/`;
    await removeObjectsWithPrefix(prefix);
  }

  // Delete folders from DB
  await getDb()
    .delete(uploads)
    .where(inArray(uploads.id, folderUploads.map((u) => u.id)));

  // Emit room events
  for (const upload of folderUploads) {
    await createRoomEvent(upload.roomId, "folder.deleted", { uploadId: upload.id });
  }

  return { success: true };
}

export async function createUploadUrlAction(
  roomId: string,
  input: CreateUploadInput
) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);
  const validatedInput = createUploadSchema.parse(input);

  const objectKey = validatedInput.uploadId
    ? `${roomId}/${validatedInput.uploadId}/${validatedInput.fileName}`
    : `${roomId}/${crypto.randomUUID()}-${validatedInput.fileName}`;

  const uploadUrl = await createSignedUploadUrl(
    objectKey,
    validatedInput.contentType
  );

  return { objectKey, uploadUrl };
}

export async function completeUploadAction(
  roomId: string,
  input: CompleteUploadInput
) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);
  const validatedInput = completeUploadSchema.parse(input);

  const objectMetadata = await getObjectMetadata(validatedInput.objectKey);
  if (objectMetadata.sizeBytes !== validatedInput.sizeBytes) {
    throw new Error("Uploaded object could not be verified.");
  }

  if (validatedInput.uploadId) {
    const [existingUpload] = await getDb()
      .select()
      .from(uploads)
      .where(eq(uploads.id, validatedInput.uploadId))
      .limit(1);

    if (!existingUpload) {
      await getDb().insert(uploads).values({
        id: validatedInput.uploadId,
        roomId,
        uploaderId: session.user.id,
        name: validatedInput.folderName || "Untitled Folder",
      });
    }
  }

  const [file] = await getDb()
    .insert(uploadedFiles)
    .values({
      roomId,
      uploaderId: session.user.id,
      uploadId: validatedInput.uploadId || null,
      objectKey: validatedInput.objectKey,
      fileName: validatedInput.fileName,
      contentType: objectMetadata.contentType ?? validatedInput.contentType,
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
      uploadName: validatedInput.uploadId
        ? validatedInput.folderName || "Untitled Folder"
        : null,
    },
  });

  return { fileId: file.id };
}

export async function createUploadUrlsAction(
  roomId: string,
  inputs: CreateUploadInput[]
) {
  if (inputs.length === 0) return [];
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);

  const results = [];
  for (const input of inputs) {
    const validatedInput = createUploadSchema.parse(input);
    const objectKey = validatedInput.uploadId
      ? `${roomId}/${validatedInput.uploadId}/${validatedInput.fileName}`
      : `${roomId}/${crypto.randomUUID()}-${validatedInput.fileName}`;

    const uploadUrl = await createSignedUploadUrl(
      objectKey,
      validatedInput.contentType
    );
    results.push({ objectKey, uploadUrl, fileName: validatedInput.fileName });
  }

  return results;
}

export async function completeUploadsAction(
  roomId: string,
  inputs: CompleteUploadInput[]
) {
  if (inputs.length === 0) return { success: true };
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);

  const uploadIdMap = new Map<string, string>();
  for (const input of inputs) {
    if (input.uploadId && input.folderName) {
      uploadIdMap.set(input.uploadId, input.folderName);
    }
  }

  for (const [uploadId, folderName] of uploadIdMap.entries()) {
    const [existingUpload] = await getDb()
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!existingUpload) {
      await getDb().insert(uploads).values({
        id: uploadId,
        roomId,
        uploaderId: session.user.id,
        name: folderName,
      });
    }
  }

  const completed = [];
  for (const input of inputs) {
    const validatedInput = completeUploadSchema.parse(input);
    try {
      const objectMetadata = await getObjectMetadata(validatedInput.objectKey);
      if (objectMetadata.sizeBytes !== validatedInput.sizeBytes) {
        continue;
      }

      const [file] = await getDb()
        .insert(uploadedFiles)
        .values({
          roomId,
          uploaderId: session.user.id,
          uploadId: validatedInput.uploadId || null,
          objectKey: validatedInput.objectKey,
          fileName: validatedInput.fileName,
          contentType: objectMetadata.contentType ?? validatedInput.contentType,
          sizeBytes: objectMetadata.sizeBytes,
        })
        .returning();

      completed.push(file);

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
          uploadName: validatedInput.uploadId
            ? validatedInput.folderName || "Untitled Folder"
            : null,
        },
      });
    } catch (err) {
      console.error(`Failed to complete upload for key: ${validatedInput.objectKey}`, err);
    }
  }

  return { success: true, count: completed.length };
}

export async function getFileDownloadUrlAction(fileId: string) {
  const session = await requireRequestSession();
  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("File not found.");
  }

  await requireRoomAccess(file.roomId, session.user.id);
  const url = await createSignedDownloadUrl(file.objectKey, file.fileName);
  return { url, fileName: file.fileName };
}
