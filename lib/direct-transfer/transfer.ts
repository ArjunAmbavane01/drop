import type { UploadGroup } from "@/components/room/files/types";
import type { DirectControlMessage } from "./types";
import { DirectPeerConnection } from "./peer-connection";

const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 1024 * 1024;

function sendControl(peer: DirectPeerConnection, message: DirectControlMessage) {
  peer.send(JSON.stringify(message));
}

export async function sendUploadGroup(
  peer: DirectPeerConnection,
  group: UploadGroup,
  onProgress: (transferredBytes: number, speedBytesPerSecond: number) => void,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException("Transfer cancelled.", "AbortError");
  const totalBytes = group.files.reduce((total, item) => total + item.file.size, 0);
  sendControl(peer, {
    type: "transfer-start",
    transferId: group.id,
    name: group.name,
    transferType: group.type,
    fileCount: group.files.length,
    totalBytes,
  });

  let transferredBytes = 0;
  const startedAt = performance.now();
  peer.setBufferedAmountLowThreshold(BUFFER_LIMIT / 2);

  try {
    for (const fileInfo of group.files) {
      if (signal.aborted) throw new DOMException("Transfer cancelled.", "AbortError");
      sendControl(peer, {
        type: "file-start",
        path: fileInfo.relativePath,
        size: fileInfo.file.size,
        contentType: fileInfo.file.type || "application/octet-stream",
      });

      for (let offset = 0; offset < fileInfo.file.size; offset += CHUNK_SIZE) {
        if (signal.aborted) throw new DOMException("Transfer cancelled.", "AbortError");
        await peer.waitForBufferedAmountLow();
        const chunk = await fileInfo.file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        peer.send(chunk);
        transferredBytes += chunk.byteLength;
        const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
        onProgress(transferredBytes, transferredBytes / elapsedSeconds);
      }
      sendControl(peer, { type: "file-end" });
    }
    sendControl(peer, { type: "transfer-complete" });
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      try { sendControl(peer, { type: "transfer-cancelled", reason: "Cancelled by sender." }); } catch { /* closed peer */ }
    }
    throw error;
  }
}
