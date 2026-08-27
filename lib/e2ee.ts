export const CHUNK_SIZE = 1024 * 1024; // 1 MB
export const OVERHEAD_PER_CHUNK = 28; // 12 bytes IV + 16 bytes auth tag

const DB_NAME = "drop-e2ee";
const STORE_NAME = "keys";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getStoredKeyPair(deviceId: string): Promise<CryptoKeyPair | null> {
  if (typeof window === "undefined") return null;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(deviceId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function storeKeyPair(deviceId: string, keyPair: CryptoKeyPair): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(keyPair, deviceId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem("drop-device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("drop-device-id", deviceId);
  }
  return deviceId;
}

export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
  const spkiBuffer = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(spkiBuffer);
}

export async function importPublicKeySpki(spkiB64: string): Promise<CryptoKey> {
  const spkiBuffer = base64ToArrayBuffer(spkiB64);
  return crypto.subtle.importKey(
    "spki",
    spkiBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

export function getChunkAad(fileId: string, chunkIndex: number, totalChunks: number): Uint8Array {
  const encoder = new TextEncoder();
  const fileIdBytes = encoder.encode(fileId);
  const aad = new Uint8Array(36 + 4 + 4);
  aad.set(fileIdBytes, 0);

  const view = new DataView(aad.buffer);
  view.setUint32(36, chunkIndex, false); // big-endian
  view.setUint32(40, totalChunks, false); // big-endian

  return aad;
}

export function getEncryptedSize(originalSize: number): number {
  if (originalSize === 0) return OVERHEAD_PER_CHUNK;
  const numChunks = Math.ceil(originalSize / CHUNK_SIZE);
  return originalSize + numChunks * OVERHEAD_PER_CHUNK;
}

export function getOriginalSize(encryptedSize: number): number {
  if (encryptedSize <= OVERHEAD_PER_CHUNK) return 0;
  const numChunks = Math.ceil(encryptedSize / (CHUNK_SIZE + OVERHEAD_PER_CHUNK));
  return encryptedSize - numChunks * OVERHEAD_PER_CHUNK;
}

export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function wrapFileKey(fileKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", fileKey);
  const wrappedBuffer = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawKey
  );
  return arrayBufferToBase64(wrappedBuffer);
}

export async function unwrapFileKey(wrappedKeyB64: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
  const wrappedBuffer = base64ToArrayBuffer(wrappedKeyB64);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    wrappedBuffer
  );
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptChunk(
  chunkData: Uint8Array,
  fileKey: CryptoKey,
  fileId: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = getChunkAad(fileId, chunkIndex, totalChunks);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad as unknown as BufferSource,
    },
    fileKey,
    chunkData as unknown as BufferSource
  );

  const result = new Uint8Array(12 + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), 12);
  return result;
}

export async function decryptChunk(
  encryptedChunk: Uint8Array,
  fileKey: CryptoKey,
  fileId: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Uint8Array> {
  if (encryptedChunk.byteLength < 28) {
    throw new Error("Ciphertext too short.");
  }
  const iv = encryptedChunk.slice(0, 12);
  const ciphertextAndTag = encryptedChunk.slice(12);
  const aad = getChunkAad(fileId, chunkIndex, totalChunks);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad as unknown as BufferSource,
    },
    fileKey,
    ciphertextAndTag as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

export async function getClientDeviceKey() {
  const deviceId = getOrCreateDeviceId();
  const keyPair = await getStoredKeyPair(deviceId);
  if (!keyPair) {
    throw new Error("E2EE device key pair not initialized.");
  }
  return { deviceId, keyPair };
}

export async function ensureDeviceKeyRegistered(
  registerPublicKeyAction: (deviceId: string, spki: string) => Promise<unknown>
) {
  const deviceId = getOrCreateDeviceId();
  let keyPair = await getStoredKeyPair(deviceId);
  if (!keyPair) {
    keyPair = await generateDeviceKeyPair();
    await storeKeyPair(deviceId, keyPair);
  }
  const spki = await exportPublicKeySpki(keyPair.publicKey);
  await registerPublicKeyAction(deviceId, spki);
  return { deviceId, keyPair };
}

export async function syncMissingFileKeys(
  roomId: string,
  getMissingWrapsAction: (roomId: string, deviceId: string) => Promise<{ missingWraps: { fileId: string; myWrappedKey: string; missingPublicKeys: { id: string; publicKey: string }[] }[] }>,
  uploadWrappedKeysAction: (wraps: { fileId: string; publicKeyId: string; encryptedKey: string }[]) => Promise<unknown>
) {
  try {
    const { deviceId, keyPair } = await getClientDeviceKey();
    const { missingWraps } = await getMissingWrapsAction(roomId, deviceId);

    if (!missingWraps || missingWraps.length === 0) {
      return;
    }

    const newWraps: { fileId: string; publicKeyId: string; encryptedKey: string }[] = [];

    for (const wrapInfo of missingWraps) {
      try {
        const fileKey = await unwrapFileKey(wrapInfo.myWrappedKey, keyPair.privateKey);

        for (const pubKeyInfo of wrapInfo.missingPublicKeys) {
          try {
            const rsaPubKey = await importPublicKeySpki(pubKeyInfo.publicKey);
            const encryptedKey = await wrapFileKey(fileKey, rsaPubKey);
            newWraps.push({
              fileId: wrapInfo.fileId,
              publicKeyId: pubKeyInfo.id,
              encryptedKey,
            });
          } catch (err) {
            console.error(`Failed to wrap key for public key ${pubKeyInfo.id}`, err);
          }
        }
      } catch (err) {
        console.error(`Failed to decrypt file key for file ${wrapInfo.fileId}`, err);
      }
    }

    if (newWraps.length > 0) {
      await uploadWrappedKeysAction(newWraps);
    }
  } catch (error) {
    console.error("Error in syncMissingFileKeys:", error);
  }
}
