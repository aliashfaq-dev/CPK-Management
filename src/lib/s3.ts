import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-only S3 client. Uses `forcePathStyle: true` so both Neon Object Storage and local MinIO
 * work without DNS virtual-hosted buckets. Credentials and endpoints never leave the server.
 */

interface S3Globals {
  __cpkS3?: { signature: string; client: S3Client };
}
const store = globalThis as typeof globalThis & S3Globals;

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
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
    credentials: { accessKeyId, secretAccessKey },
  });
  store.__cpkS3 = { signature, client };
  return client;
}

/** Builds a 5-minute presigned GET URL for an event image key. */
export async function presignEventObjectUrl(rowBucket: string | null | undefined, key: string): Promise<string> {
  const bucket = rowBucket?.trim() || getDefaultBucket();
  if (!bucket) {
    throw new Error("S3 bucket is not configured.");
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}
