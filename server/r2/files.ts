import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "stream";

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

export async function removeObjectsWithPrefix(prefix: string) {
  const r2 = getR2();
  let continuationToken: string | undefined = undefined;

  do {
    const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: env.r2BucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const listResponse = await r2.send(listCommand);
    const objects = listResponse.Contents ?? [];

    if (objects.length > 0) {
      const deleteCommand: DeleteObjectsCommand = new DeleteObjectsCommand({
        Bucket: env.r2BucketName,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key! })),
          Quiet: true,
        },
      });
      await r2.send(deleteCommand);
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);
}

export async function listObjectsWithPrefix(prefix: string) {
  const r2 = getR2();
  let continuationToken: string | undefined = undefined;
  const keys: string[] = [];

  do {
    const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: env.r2BucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const listResponse = await r2.send(listCommand);
    const objects = listResponse.Contents ?? [];
    for (const obj of objects) {
      if (obj.Key) {
        keys.push(obj.Key);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

export async function getObjectStream(objectKey: string): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: env.r2BucketName,
    Key: objectKey,
  });
  const response = await getR2().send(command);
  if (!response.Body) {
    throw new Error(`No body for object: ${objectKey}`);
  }
  return response.Body as Readable;
}

