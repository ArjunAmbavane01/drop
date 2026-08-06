"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  rooms,
  roomMemberships,
  roomTexts,
  uploads,
  uploadedFiles,
} from "@/db/schema";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess, requireRoomOwner } from "@/server/rooms/auth";
import { createRoomEvent } from "@/server/rooms/events";
import { removeObject, removeObjectsWithPrefix } from "@/server/r2/files";
import { createRoomCode } from "@/lib/utils/room";
import {
  createRoomSchema,
  joinRoomSchema,
  updateTextSchema,
  renameFileSchema,
  renameFolderSchema,
  type CreateRoomInput,
  type JoinRoomInput,
  type UpdateTextInput,
  type RenameFileInput,
  type RenameFolderInput,
} from "@/lib/validators";

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

  await getDb().delete(rooms).where(eq(rooms.id, roomId));

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
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.roomId, roomId));

  await Promise.all(roomFiles.map((file) => removeObject(file.objectKey)));

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
