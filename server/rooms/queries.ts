import { and, asc, desc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { uploads, uploadedFiles, roomMemberships, rooms, roomTexts, users } from "@/db/schema";
import { env } from "@/lib/env";
import type { RoomSnapshot } from "@/types/rooms";

export async function getInitialRoomForUser(userId: string) {
  const [membership] = await getDb()
    .select({ id: roomMemberships.roomId })
    .from(roomMemberships)
    .where(eq(roomMemberships.userId, userId))
    .orderBy(desc(roomMemberships.joinedAt))
    .limit(1);

  return membership ?? null;
}

export async function getRoomSnapshot(roomId: string, userId: string): Promise<RoomSnapshot> {
  const [membership] = await getDb()
    .select({ roomId: roomMemberships.roomId })
    .from(roomMemberships)
    .where(eq(roomMemberships.roomId, roomId))
    .limit(1);

  if (!membership) {
    notFound();
  }

  const [room] = await getDb()
    .select({
      id: rooms.id,
      name: rooms.name,
      roomCode: rooms.roomCode,
      ownerId: rooms.ownerId,
    })
    .from(rooms)
    .innerJoin(
      roomMemberships,
      eq(roomMemberships.roomId, rooms.id),
    )
    .where(eq(roomMemberships.userId, userId))
    .limit(1);

  if (!room) {
    notFound();
  }

  const [textRow] = await getDb()
    .select()
    .from(roomTexts)
    .where(eq(roomTexts.roomId, roomId))
    .limit(1);

  const members = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(roomMemberships)
    .innerJoin(users, eq(users.id, roomMemberships.userId))
    .where(eq(roomMemberships.roomId, roomId))
    .orderBy(asc(users.name));

  const fileRows = await getDb()
    .select({
      id: uploadedFiles.id,
      fileName: uploadedFiles.fileName,
      contentType: uploadedFiles.contentType,
      sizeBytes: uploadedFiles.sizeBytes,
      objectKey: uploadedFiles.objectKey,
      uploadedAt: uploadedFiles.uploadedAt,
      uploaderId: users.id,
      uploaderName: users.name,
      uploadId: uploadedFiles.uploadId,
      uploadName: uploads.name,
    })
    .from(uploadedFiles)
    .innerJoin(users, eq(users.id, uploadedFiles.uploaderId))
    .leftJoin(uploads, eq(uploads.id, uploadedFiles.uploadId))
    .where(eq(uploadedFiles.roomId, roomId))
    .orderBy(desc(uploadedFiles.uploadedAt));

  return {
    room,
    text: {
      value: textRow?.text ?? "",
      updatedAt: (textRow?.updatedAt ?? new Date()).toISOString(),
      updatedByUserId: textRow?.updatedByUserId ?? null,
    },
    members,
    files: fileRows.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      objectKey: file.objectKey,
      uploadedAt: file.uploadedAt.toISOString(),
      uploader: {
        id: file.uploaderId,
        name: file.uploaderName,
      },
      thumbnailUrl: file.contentType?.startsWith("image/")
        ? `${env.r2PublicBaseUrl}/${file.objectKey}`
        : null,
      uploadId: file.uploadId,
      uploadName: file.uploadName,
    })),
  };
}

export async function getRoomsForUser(userId: string) {
  // Query all rooms where ownerId === userId
  const myRooms = await getDb()
    .select({
      id: rooms.id,
      name: rooms.name,
      roomCode: rooms.roomCode,
      ownerId: rooms.ownerId,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(eq(rooms.ownerId, userId))
    .orderBy(desc(rooms.createdAt));

  // Query all rooms the user has joined (exist in roomMemberships) but is NOT the owner
  const joinedRooms = await getDb()
    .select({
      id: rooms.id,
      name: rooms.name,
      roomCode: rooms.roomCode,
      ownerId: rooms.ownerId,
      createdAt: rooms.createdAt,
    })
    .from(roomMemberships)
    .innerJoin(rooms, eq(rooms.id, roomMemberships.roomId))
    .where(
      and(
        eq(roomMemberships.userId, userId),
        ne(rooms.ownerId, userId)
      )
    )
    .orderBy(desc(roomMemberships.joinedAt));

  return { myRooms, joinedRooms };
}
