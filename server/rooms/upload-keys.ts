export function buildUploadObjectKey(
  roomId: string,
  input: {
    fileName: string;
    uploadId?: string | null;
  },
) {
  return input.uploadId
    ? `${roomId}/${input.uploadId}/${input.fileName}`
    : `${roomId}/${crypto.randomUUID()}-${input.fileName}`;
}
