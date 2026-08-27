"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { LIMITS } from "@/lib/limits";
import { getRedis, getJoinRateLimiter } from "@/lib/ratelimit";
import { validateUploadQuota } from "@/server/rooms/quota";
import { DEFAULT_EXCLUSIONS, compileExclusionMatcher } from "@/lib/exclusions";
import { updateExclusionsSchema, type UpdateExclusionsInput } from "@/lib/validators";
import {
  users,
  rooms,
  roomMemberships,
  roomTexts,
  uploads,
  uploadedFiles,
  userPublicKeys,
  fileKeys,
} from "@/db/schema";
import { getEncryptedSize } from "@/lib/e2ee";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess, requireRoomOwner } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { createRoomCode } from "@/lib/room";
import {
  createRoomSchema,
  joinRoomSchema,
  updateTextSchema,
  renameFileSchema,
  renameFolderSchema,
  completeUploadSchema,
  type CreateRoomInput,
  type JoinRoomInput,
  type UpdateTextInput,
  type RenameFileInput,
  type RenameFolderInput,
  type CompleteUploadInput,
} from "@/lib/validators";
import {
  createSignedDownloadUrl,
  getObjectMetadata,
  removeObject,
  removeObjects,
  removeObjectsWithPrefix,
  getR2PublicObjectUrl,
} from "@/server/r2/files";
import { getRoomSnapshot } from "@/server/rooms/queries";

export async function createRoomAction(input: CreateRoomInput) {
  const session = await requireRequestSession();
  const validatedInput = createRoomSchema.parse(input);

  const ownedRooms = await getDb()
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.ownerId, session.user.id));

  if (ownedRooms.length >= LIMITS.MAX_ROOMS_PER_USER) {
    throw new Error(
      `You have reached the maximum limit of ${LIMITS.MAX_ROOMS_PER_USER} rooms. A room must be deleted before creating another.`
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

  const { success } = await getJoinRateLimiter().limit(session.user.id);
  if (!success) {
    throw new Error(`Join rate limit exceeded. You can join up to ${LIMITS.JOIN_LIMIT_PER_MIN} rooms per minute.`);
  }

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

  // Revoke E2EE file keys for this user in this room
  const userPubKeys = await getDb()
    .select({ id: userPublicKeys.id })
    .from(userPublicKeys)
    .where(eq(userPublicKeys.userId, session.user.id));

  const userPubKeyIds = userPubKeys.map((k) => k.id);

  if (userPubKeyIds.length > 0) {
    const roomFiles = await getDb()
      .select({ id: uploadedFiles.id })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.roomId, roomId));

    const roomFileIds = roomFiles.map((f) => f.id);

    if (roomFileIds.length > 0) {
      await getDb()
        .delete(fileKeys)
        .where(
          and(
            inArray(fileKeys.fileId, roomFileIds),
            inArray(fileKeys.publicKeyId, userPubKeyIds)
          )
        );
    }
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

async function insertFileKeyWraps(
  roomId: string,
  fileId: string,
  wrappedKeys: { publicKeyId: string; encryptedKey: string }[] | undefined
) {
  if (!wrappedKeys || wrappedKeys.length === 0) return;

  const roomMembershipsList = await getDb()
    .select({ userId: roomMemberships.userId })
    .from(roomMemberships)
    .where(eq(roomMemberships.roomId, roomId));
  const memberUserIds = new Set(roomMembershipsList.map((m) => m.userId));

  for (const wrap of wrappedKeys) {
    const [pubKey] = await getDb()
      .select({ userId: userPublicKeys.userId })
      .from(userPublicKeys)
      .where(eq(userPublicKeys.id, wrap.publicKeyId))
      .limit(1);

    if (pubKey && memberUserIds.has(pubKey.userId)) {
      await getDb()
        .insert(fileKeys)
        .values({
          fileId,
          publicKeyId: wrap.publicKeyId,
          encryptedKey: wrap.encryptedKey,
        })
        .onConflictDoUpdate({
          target: [fileKeys.fileId, fileKeys.publicKeyId],
          set: {
            encryptedKey: wrap.encryptedKey,
            createdAt: new Date(),
          },
        });
    }
  }
}

export async function completeUploadAction(
  roomId: string,
  input: CompleteUploadInput
) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);
  const validatedInput = completeUploadSchema.parse(input);

  const objectMetadata = await getObjectMetadata(validatedInput.objectKey);
  if (objectMetadata.sizeBytes !== getEncryptedSize(validatedInput.sizeBytes)) {
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
      id: validatedInput.fileId || undefined,
      roomId,
      uploaderId: session.user.id,
      uploadId: validatedInput.uploadId || null,
      objectKey: validatedInput.objectKey,
      fileName: validatedInput.fileName,
      contentType: objectMetadata.contentType ?? validatedInput.contentType,
      sizeBytes: validatedInput.sizeBytes,
      encryptedSizeBytes: objectMetadata.sizeBytes,
    })
    .returning();

  if (validatedInput.wrappedKeys && validatedInput.wrappedKeys.length > 0) {
    await insertFileKeyWraps(roomId, file.id, validatedInput.wrappedKeys);
  }

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
        ? getR2PublicObjectUrl(file.objectKey)
        : null,
      uploadId: file.uploadId,
      uploadName: validatedInput.uploadId
        ? validatedInput.folderName || "Untitled Folder"
        : null,
    },
  });

  return { fileId: file.id };
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
      if (objectMetadata.sizeBytes !== getEncryptedSize(validatedInput.sizeBytes)) {
        continue;
      }

      const [file] = await getDb()
        .insert(uploadedFiles)
        .values({
          id: validatedInput.fileId || undefined,
          roomId,
          uploaderId: session.user.id,
          uploadId: validatedInput.uploadId || null,
          objectKey: validatedInput.objectKey,
          fileName: validatedInput.fileName,
          contentType: objectMetadata.contentType ?? validatedInput.contentType,
          sizeBytes: validatedInput.sizeBytes,
          encryptedSizeBytes: objectMetadata.sizeBytes,
        })
        .returning();

      completed.push(file);

      if (validatedInput.wrappedKeys && validatedInput.wrappedKeys.length > 0) {
        await insertFileKeyWraps(roomId, file.id, validatedInput.wrappedKeys);
      }

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
            ? getR2PublicObjectUrl(file.objectKey)
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

export async function refreshRoomFilesAction(roomId: string) {
  const session = await requireRequestSession();
  const snapshot = await getRoomSnapshot(roomId, session.user.id);
  return { files: snapshot.files };
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

export async function preValidateUploadAction(
  roomId: string,
  files: { name: string; size: number }[],
  options?: { isFolder?: boolean; includeExcluded?: boolean }
) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);

  try {
    let filesToValidate = files;
    if (options?.isFolder && !options?.includeExcluded) {
      const [user] = await getDb()
        .select({ uploadExclusions: users.uploadExclusions })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      const exclusions = user?.uploadExclusions ?? DEFAULT_EXCLUSIONS;
      const matcher = compileExclusionMatcher(exclusions);
      filesToValidate = files.filter((f) => !matcher(f.name));
    }

    await validateUploadQuota(session.user.id, roomId, filesToValidate);

    const uploadToken = randomUUID();
    const tokenData = {
      userId: session.user.id,
      roomId,
      files: filesToValidate.map((f) => ({ name: f.name, size: f.size })),
    };

    await getRedis().set(
      `upload-token:${uploadToken}`,
      JSON.stringify(tokenData),
      { ex: 120 } // 2 minutes expiration
    );

    return { success: true, uploadToken };
  } catch (error) {
    const err = error as Error;
    const message = err.message || "";

    if (message === "too-many-files") {
      return { success: false, error: "too-many-files" };
    }

    if (
      [
        "room-quota-exceeded",
        "user-quota-exceeded",
        "upload-rate-limit-exceeded",
      ].includes(message)
    ) {
      return { success: false, error: message };
    }

    const colonErrors = [
      "file-too-large",
      "path-too-long",
      "invalid-path",
      "filename-too-long",
      "folder-depth-exceeded",
      "duplicate-path",
      "conflicting-path",
    ];

    for (const prefix of colonErrors) {
      if (message.startsWith(`${prefix}:`)) {
        const detail = message.substring(prefix.length + 1);
        return { success: false, error: prefix, detail, fileName: detail };
      }
    }

    return {
      success: false,
      error: "unknown",
      message: "An unexpected error occurred during pre-validation.",
    };
  }
}

export async function registerPublicKeyAction(deviceId: string, publicKeySpkiB64: string) {
  const session = await requireRequestSession();
  const userId = session.user.id;
  const id = `${userId}:${deviceId}`;

  await getDb()
    .insert(userPublicKeys)
    .values({
      id,
      userId,
      deviceId,
      publicKey: publicKeySpkiB64,
    })
    .onConflictDoUpdate({
      target: [userPublicKeys.userId, userPublicKeys.deviceId],
      set: {
        publicKey: publicKeySpkiB64,
        createdAt: new Date(),
      },
    });

  return { success: true, publicKeyId: id };
}

export async function getRoomPublicKeysAction(roomId: string) {
  const session = await requireRequestSession();
  await requireRoomAccess(roomId, session.user.id);

  const keys = await getDb()
    .select({
      id: userPublicKeys.id,
      userId: userPublicKeys.userId,
      deviceId: userPublicKeys.deviceId,
      publicKey: userPublicKeys.publicKey,
    })
    .from(userPublicKeys)
    .innerJoin(
      roomMemberships,
      eq(userPublicKeys.userId, roomMemberships.userId)
    )
    .where(eq(roomMemberships.roomId, roomId));

  return { keys };
}

export async function getMissingWrapsAction(roomId: string, deviceId: string) {
  const session = await requireRequestSession();
  const currentUserId = session.user.id;
  await requireRoomAccess(roomId, currentUserId);

  const myPublicKeyId = `${currentUserId}:${deviceId}`;

  const files = await getDb()
    .select({ id: uploadedFiles.id })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));

  if (files.length === 0) {
    return { missingWraps: [] };
  }

  const memberKeys = await getDb()
    .select({
      id: userPublicKeys.id,
      userId: userPublicKeys.userId,
      publicKey: userPublicKeys.publicKey,
    })
    .from(userPublicKeys)
    .innerJoin(
      roomMemberships,
      eq(userPublicKeys.userId, roomMemberships.userId)
    )
    .where(eq(roomMemberships.roomId, roomId));

  if (memberKeys.length === 0) {
    return { missingWraps: [] };
  }

  const fileIds = files.map((f) => f.id);

  const existingWraps = await getDb()
    .select()
    .from(fileKeys)
    .where(inArray(fileKeys.fileId, fileIds));

  const wrapsByFile = new Map<string, typeof existingWraps>();
  for (const wrap of existingWraps) {
    if (!wrapsByFile.has(wrap.fileId)) {
      wrapsByFile.set(wrap.fileId, []);
    }
    wrapsByFile.get(wrap.fileId)!.push(wrap);
  }

  const missingWraps: {
    fileId: string;
    myWrappedKey: string;
    missingPublicKeys: { id: string; publicKey: string }[];
  }[] = [];

  for (const file of files) {
    const fileWraps = wrapsByFile.get(file.id) || [];
    const myWrap = fileWraps.find((w) => w.publicKeyId === myPublicKeyId);

    if (!myWrap) {
      continue;
    }

    const missingKeysForThisFile = memberKeys.filter(
      (mk) => !fileWraps.some((w) => w.publicKeyId === mk.id)
    );

    if (missingKeysForThisFile.length > 0) {
      missingWraps.push({
        fileId: file.id,
        myWrappedKey: myWrap.encryptedKey,
        missingPublicKeys: missingKeysForThisFile.map((mk) => ({
          id: mk.id,
          publicKey: mk.publicKey,
        })),
      });
    }
  }

  return { missingWraps };
}

export async function uploadWrappedKeysAction(
  wraps: { fileId: string; publicKeyId: string; encryptedKey: string }[]
) {
  const session = await requireRequestSession();
  const currentUserId = session.user.id;

  if (wraps.length === 0) return { success: true };

  const fileRoomCache = new Map<string, string>();
  const roomMemberCache = new Map<string, Set<string>>();

  for (const wrap of wraps) {
    let roomId = fileRoomCache.get(wrap.fileId);
    if (!roomId) {
      const [file] = await getDb()
        .select({ roomId: uploadedFiles.roomId })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, wrap.fileId))
        .limit(1);

      if (!file) {
        throw new Error(`File ${wrap.fileId} not found.`);
      }
      roomId = file.roomId;
      fileRoomCache.set(wrap.fileId, roomId);
    }

    await requireRoomAccess(roomId, currentUserId);

    const [pubKey] = await getDb()
      .select({ userId: userPublicKeys.userId })
      .from(userPublicKeys)
      .where(eq(userPublicKeys.id, wrap.publicKeyId))
      .limit(1);

    if (!pubKey) {
      throw new Error(`Public key ${wrap.publicKeyId} not found.`);
    }

    let members = roomMemberCache.get(roomId);
    if (!members) {
      const memberships = await getDb()
        .select({ userId: roomMemberships.userId })
        .from(roomMemberships)
        .where(eq(roomMemberships.roomId, roomId));
      members = new Set(memberships.map((m) => m.userId));
      roomMemberCache.set(roomId, members);
    }

    if (!members.has(pubKey.userId)) {
      throw new Error(`Target user ${pubKey.userId} is not a member of room ${roomId}.`);
    }

    await getDb()
      .insert(fileKeys)
      .values({
        fileId: wrap.fileId,
        publicKeyId: wrap.publicKeyId,
        encryptedKey: wrap.encryptedKey,
      })
      .onConflictDoUpdate({
        target: [fileKeys.fileId, fileKeys.publicKeyId],
        set: {
          encryptedKey: wrap.encryptedKey,
          createdAt: new Date(),
        },
      });
  }

  return { success: true };
}

export async function getFileDownloadKeyAction(fileId: string, deviceId: string) {
  const session = await requireRequestSession();
  const currentUserId = session.user.id;

  const [file] = await getDb()
    .select({ roomId: uploadedFiles.roomId })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("File not found.");
  }

  await requireRoomAccess(file.roomId, currentUserId);

  const publicKeyId = `${currentUserId}:${deviceId}`;
  const [wrap] = await getDb()
    .select({ encryptedKey: fileKeys.encryptedKey })
    .from(fileKeys)
    .where(
      and(
        eq(fileKeys.fileId, fileId),
        eq(fileKeys.publicKeyId, publicKeyId)
      )
    )
    .limit(1);

  if (!wrap) {
    throw new Error("No wrapped key found for this device.");
  }

  return { encryptedKey: wrap.encryptedKey };
}

export async function getUserExclusionsAction() {
  const session = await requireRequestSession();
  const [userRecord] = await getDb()
    .select({ uploadExclusions: users.uploadExclusions })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const isCustomized = userRecord?.uploadExclusions !== null;
  const exclusions = userRecord?.uploadExclusions ?? DEFAULT_EXCLUSIONS;

  return { exclusions, isCustomized };
}

export async function saveExclusionsAction(input: UpdateExclusionsInput) {
  const session = await requireRequestSession();
  const validatedInput = updateExclusionsSchema.parse(input);

  await getDb()
    .update(users)
    .set({
      uploadExclusions: validatedInput.patterns,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return { success: true, exclusions: validatedInput.patterns };
}

export async function restoreDefaultExclusionsAction() {
  const session = await requireRequestSession();
  await getDb()
    .update(users)
    .set({
      uploadExclusions: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return { success: true, exclusions: DEFAULT_EXCLUSIONS };
}
