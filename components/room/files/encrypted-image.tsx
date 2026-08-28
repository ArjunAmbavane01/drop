"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";
import type { RoomFile } from "@/types/rooms";
import { getClientDeviceKey, unwrapFileKey, decryptChunk, CHUNK_SIZE, OVERHEAD_PER_CHUNK } from "@/lib/e2ee";
import { getFileDownloadKeyAction } from "@/server/rooms/actions";
import { Spinner } from "@/components/ui/spinner";

// Global cache for decrypted thumbnail URLs: fileId -> blobUrl
const decryptedCache = new Map<string, string>();
interface EncryptedImageProps extends Omit<ImageProps, "src" | "alt"> {
  file: RoomFile;
}

async function decryptFullBlob(
  encryptedStream: ReadableStream<Uint8Array>,
  fileKey: CryptoKey,
  fileId: string,
  originalSize: number
): Promise<Blob> {
  const reader = encryptedStream.getReader();
  const decryptedChunks: Uint8Array[] = [];
  let buffer = new Uint8Array(0);
  let chunkIndex = 0;
  const totalChunks = Math.ceil(originalSize / CHUNK_SIZE) || 1;
  const encryptedChunkSize = CHUNK_SIZE + OVERHEAD_PER_CHUNK;

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      const nextBuffer = new Uint8Array(buffer.length + value.length);
      nextBuffer.set(buffer, 0);
      nextBuffer.set(value, buffer.length);
      buffer = nextBuffer;
    }

    while (buffer.length > 0) {
      const expectedSize = chunkIndex < totalChunks - 1
        ? encryptedChunkSize
        : (originalSize - chunkIndex * CHUNK_SIZE) + OVERHEAD_PER_CHUNK;

      if (buffer.length >= expectedSize) {
        const encryptedChunk = buffer.slice(0, expectedSize);
        const decrypted = await decryptChunk(
          encryptedChunk,
          fileKey,
          fileId,
          chunkIndex,
          totalChunks
        );
        decryptedChunks.push(decrypted);

        buffer = buffer.slice(expectedSize);
        chunkIndex++;
      } else {
        break;
      }
    }

    if (done) {
      break;
    }
  }

  return new Blob(decryptedChunks as unknown as BlobPart[]);
}

export function EncryptedImage({ file, ...props }: EncryptedImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function loadDecryptedImage() {
      if (!file.thumbnailUrl) {
        setStatus("error");
        return;
      }

      // Check cache first
      if (decryptedCache.has(file.id)) {
        if (active) {
          setSrc(decryptedCache.get(file.id)!);
          setStatus("success");
        }
        return;
      }

      try {
        const { deviceId, keyPair } = await getClientDeviceKey();
        const { encryptedKey } = await getFileDownloadKeyAction(file.id, deviceId);
        const fileKey = await unwrapFileKey(encryptedKey, keyPair.privateKey);

        const response = await fetch(file.thumbnailUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch encrypted thumbnail image");
        }

        if (!response.body) {
          throw new Error("No body on thumbnail response");
        }

        const blob = await decryptFullBlob(
          response.body as unknown as ReadableStream<Uint8Array>,
          fileKey,
          file.id,
          file.sizeBytes
        );

        const blobUrl = URL.createObjectURL(blob);
        decryptedCache.set(file.id, blobUrl);

        if (active) {
          setSrc(blobUrl);
          setStatus("success");
        }
      } catch (err) {
        console.error("Failed to decrypt preview image:", file.fileName, err);
        if (active) {
          setStatus("error");
        }
      }
    }

    void loadDecryptedImage();

    return () => {
      active = false;
    };
  }, [file.id, file.thumbnailUrl, file.sizeBytes, file.fileName]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center bg-muted/30 border border-border/60 rounded" style={{ width: props.width, height: props.height }}>
        <Spinner />
      </div>
    );
  }

  if (status === "error" || !src) {
    return (
      <div className="flex items-center justify-center bg-muted/30 border border-border/60 rounded text-muted-foreground" style={{ width: props.width, height: props.height }}>
        <ImageIcon className="size-5" />
      </div>
    );
  }

  return <Image src={src} alt={file.fileName} {...props} />;
}
