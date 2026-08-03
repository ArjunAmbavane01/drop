import { ROOM_CODE_LENGTH } from "@/lib/constants";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(Math.random() * alphabet.length);

    return alphabet[index];
  }).join("");
}
