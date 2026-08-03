import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { files, roomMemberships, rooms, roomTexts, users } from "@/db/schema";
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
      id: files.id,
      fileName: files.fileName,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      objectKey: files.objectKey,
      uploadedAt: files.uploadedAt,
      uploaderId: users.id,
      uploaderName: users.name,
    })
    .from(files)
    .innerJoin(users, eq(users.id, files.uploaderId))
    .where(eq(files.roomId, roomId))
    .orderBy(desc(files.uploadedAt));

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
    })),
  };
}
