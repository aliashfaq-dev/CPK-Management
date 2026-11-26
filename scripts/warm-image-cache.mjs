#!/usr/bin/env node
// Pre-warms `.cache/images` with resized WebP thumbnails for the latest 200 events in PostgreSQL.
// Usage: npm run cache:warm
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, stat, rename, writeFile } from "node:fs/promises";
import https from "node:https";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import pg from "pg";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const name of [".env.local", ".env"]) {
  const file = join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    const val = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (val) process.env[m[1]] = val;
  }
}

const rawDb = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!rawDb || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("DATABASE_URL and AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are required to warm the image cache.");
  process.exit(1);
}

const cacheCfg = process.env.CACHE_DIR?.trim() || ".cache/images";
const cacheDir = isAbsolute(cacheCfg) ? cacheCfg : join(root, cacheCfg);
await mkdir(cacheDir, { recursive: true });

const dbUrl = new URL(rawDb);
const mode = dbUrl.searchParams.get("sslmode");
const ssl = mode === "require" || mode === "verify-full" || mode === "verify-ca" ? { rejectUnauthorized: true } : false;
dbUrl.searchParams.delete("sslmode");
dbUrl.searchParams.delete("channel_binding");

const pool = new pg.Pool({ connectionString: dbUrl.toString(), ssl, max: 4 });
const s3 = new S3Client({
  region: process.env.AWS_REGION?.trim() || "us-east-1",
  ...(process.env.AWS_ENDPOINT_URL_S3?.trim() ? { endpoint: process.env.AWS_ENDPOINT_URL_S3.trim() } : {}),
  forcePathStyle: true,
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 16 }),
    connectionTimeout: 5_000,
    socketTimeout: 5_000,
  }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
  },
});

function safeToken(id) {
  return /^[A-Za-z0-9_-]{1,96}$/.test(id)
    ? id
    : createHash("sha256").update(id).digest("hex").slice(0, 32);
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function warmKind(eventId, bucket, kind, key, widths) {
  const token = safeToken(eventId);
  const missing = [];
  for (const w of widths) {
    const target = join(cacheDir, `${token}_${kind}_${w}.webp`);
    if (!(await fileExists(target))) missing.push({ w, target });
  }
  if (missing.length === 0) return { skipped: widths.length, written: 0 };

  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const raw = Buffer.from(await out.Body.transformToByteArray());
  let written = 0;
  for (const { w, target } of missing) {
    const webp = await sharp(raw, { failOn: "none" })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 75, effort: 3 })
      .toBuffer();
    const tmp = `${target}.tmp-${process.pid}-${w}`;
    await writeFile(tmp, webp);
    await rename(tmp, target);
    written += 1;
  }
  return { skipped: widths.length - missing.length, written };
}

const rows = (
  await pool.query(
    `SELECT event_id, s3_bucket, vehicle_key, plate_key
     FROM public.v_events_dashboard
     WHERE vehicle_key IS NOT NULL OR plate_key IS NOT NULL
     ORDER BY event_time DESC NULLS LAST
     LIMIT 200`,
  )
).rows;

console.log(`Found ${rows.length} recent events to warm into ${cacheDir}...`);
let writtenTotal = 0;
let skippedTotal = 0;
let failedTotal = 0;

const CONCURRENCY = 6;
let cursor = 0;
async function worker() {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    const bucket = row.s3_bucket?.trim() || process.env.S3_BUCKET?.trim();
    if (!bucket) continue;
    for (const [kind, key, widths] of [
      ["vehicle", row.vehicle_key, [160, 320, 640]],
      ["plate", row.plate_key, [160, 320]],
    ]) {
      if (!key) continue;
      try {
        const res = await warmKind(row.event_id, bucket, kind, key, widths);
        writtenTotal += res.written;
        skippedTotal += res.skipped;
      } catch {
        failedTotal += 1;
      }
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
await pool.end();
console.log(`Cache warm complete: written=${writtenTotal}, alreadyCached=${skippedTotal}, failed=${failedTotal}`);
