import http from "node:http";
import https from "node:https";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

/**
 * Server-only S3 client singleton with HTTP keep-alive, maxAttempts=2, and 5s connection/socket
 * inactivity timeouts. Uses `forcePathStyle: true` for Neon Object Storage and local MinIO.
 * Credentials and endpoints never leave the server.
 */

interface S3Globals {
  __cpkS3?: { signature: string; client: S3Client };
}
const store = globalThis as typeof globalThis & S3Globals;

export class S3ObjectNotFoundError extends Error {
  constructor() {
    super("S3 object not found.");
  }
}

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim());
}

export function getDefaultBucket(): string | null {
  const bucket = process.env.S3_BUCKET?.trim();
  return bucket || null;
}

export function getS3Client(): S3Client {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials are not configured.");
  }
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim() || undefined;
  const signature = `${accessKeyId}|${region}|${endpoint ?? ""}`;

  if (store.__cpkS3 && store.__cpkS3.signature === signature) {
    return store.__cpkS3.client;
  }

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: true,
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 32 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 32 }),
      connectionTimeout: 5_000,
      socketTimeout: 5_000,
    }),
    credentials: { accessKeyId, secretAccessKey },
  });
  store.__cpkS3 = { signature, client };
  return client;
}

/** Downloads an event image object into memory on the server (never redirects the browser to S3). */
export async function fetchS3ObjectBuffer(
  rowBucket: string | null | undefined,
  key: string,
): Promise<Buffer> {
  const bucket = rowBucket?.trim() || getDefaultBucket();
  if (!bucket) {
    throw new Error("S3 bucket is not configured.");
  }

  try {
    const output = await getS3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!output.Body) {
      throw new S3ObjectNotFoundError();
    }
    const bytes = await output.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    const meta = (error as { $metadata?: { httpStatusCode?: number }; name?: string }) ?? {};
    if (
      error instanceof S3ObjectNotFoundError ||
      meta.name === "NoSuchKey" ||
      meta.name === "NotFound" ||
      meta.$metadata?.httpStatusCode === 404
    ) {
      throw new S3ObjectNotFoundError();
    }
    throw error;
  }
}

/**
 * Deletes all objects under the given prefixes in batches of up to 1,000 keys.
 * Used exclusively by the admin `empty-database` action when `deleteImages` is enabled.
 */
export async function deletePrefixesInBatches(bucket: string, prefixes: string[]): Promise<number> {
  const client = getS3Client();
  const uniquePrefixes = Array.from(
    new Set(prefixes.map((p) => p.trim()).filter((p) => p.length > 0 && p !== "/")),
  );
  let deleted = 0;

  for (const prefix of uniquePrefixes) {
    let continuationToken: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1_000,
          ContinuationToken: continuationToken,
        }),
      );
      const keys = (listed.Contents ?? [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key));

      if (keys.length > 0) {
        const result = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        );
        deleted += keys.length - (result.Errors?.length ?? 0);
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return deleted;
}
