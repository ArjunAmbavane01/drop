import type { ReceivedDirectFile } from "./types";

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function writeUint32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true); }

export async function createZipBlob(files: ReceivedDirectFile[]) {
  const chunks: BlobPart[] = [];
  const entries: { name: string; crc: number; size: number; offset: number }[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.path);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const header = new ArrayBuffer(30 + name.length);
    const view = new DataView(header);
    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint32(view, 14, crc32(data));
    writeUint32(view, 18, data.length);
    writeUint32(view, 22, data.length);
    writeUint16(view, 26, name.length);
    writeUint16(view, 28, 0);
    new Uint8Array(header, 30).set(name);
    chunks.push(header, data);
    entries.push({ name: file.path, crc: crc32(data), size: data.length, offset });
    offset += header.byteLength + data.length;
  }

  const centralStart = offset;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const header = new ArrayBuffer(46 + name.length);
    const view = new DataView(header);
    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint16(view, 14, 0);
    writeUint32(view, 16, entry.crc);
    writeUint32(view, 20, entry.size);
    writeUint32(view, 24, entry.size);
    writeUint16(view, 28, name.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, entry.offset);
    new Uint8Array(header, 46).set(name);
    chunks.push(header);
    offset += header.byteLength;
  }

  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, offset - centralStart);
  writeUint32(endView, 16, centralStart);
  chunks.push(end);
  return new Blob(chunks, { type: "application/zip" });
}

export async function downloadDirectTransfer(name: string, files: ReceivedDirectFile[], type: "file" | "folder") {
  const isFolder = type === "folder" || files.length > 1 || files.some((file) => file.path.includes("/"));
  const zipFiles = type === "folder"
    ? files.map((file) => ({ ...file, path: `${name}/${file.path}` }))
    : files;
  const blob = isFolder ? await createZipBlob(zipFiles) : files[0]?.blob;
  if (!blob) throw new Error("No received file is available.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = isFolder ? `${name}.zip` : name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
