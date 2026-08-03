import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";
import { getR2 } from "@/server/r2";

export async function createSignedUploadUrl(objectKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: env.r2BucketName,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(getR2(), command, { expiresIn: 60 * 10 });
}

export async function createSignedDownloadUrl(objectKey: string) {
  const command = new GetObjectCommand({
    Bucket: env.r2BucketName,
    Key: objectKey,
  });

  return getSignedUrl(getR2(), command, { expiresIn: 60 * 5 });
}

export async function getObjectMetadata(objectKey: string) {
  const response = await getR2().send(
    new HeadObjectCommand({
      Bucket: env.r2BucketName,
      Key: objectKey,
    }),
  );

  return {
    sizeBytes: response.ContentLength ?? 0,
    contentType: response.ContentType ?? null,
  };
}

export async function removeObject(objectKey: string) {
  await getR2().send(
    new DeleteObjectCommand({
      Bucket: env.r2BucketName,
      Key: objectKey,
    }),
  );
}
