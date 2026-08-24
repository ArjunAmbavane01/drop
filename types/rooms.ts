export type Room = {
  id: string;
  name: string;
  roomCode: string;
  ownerId: string;
  createdAt: string | Date;
};

export type RoomMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type RoomFile = {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  objectKey: string;
  uploadedAt: string;
  uploader: Pick<RoomMember, "id" | "name">;
  thumbnailUrl: string | null;
  uploadId: string | null;
  uploadName: string | null;
};

export type RoomSnapshot = {
  room: {
    id: string;
    name: string;
    roomCode: string;
    ownerId: string;
  };
  text: {
    value: string;
    updatedAt: string;
    updatedByUserId: string | null;
  };
  members: RoomMember[];
  files: RoomFile[];
  lastEventId: number;
};

export type RoomEvent =
  | { id: number; type: "text.updated"; payload: RoomSnapshot["text"] }
  | { id: number; type: "file.created"; payload: { file: RoomFile } }
  | { id: number; type: "file.renamed"; payload: { fileId: string; fileName: string } }
  | { id: number; type: "file.deleted"; payload: { fileId: string } }
  | { id: number; type: "folder.renamed"; payload: { uploadId: string; name: string } }
  | { id: number; type: "folder.deleted"; payload: { uploadId: string } }
  | { id: number; type: "room.cleared"; payload: Record<string, never> }
  | { id: number; type: "member.joined" | "member.left"; payload: { member: RoomMember } };