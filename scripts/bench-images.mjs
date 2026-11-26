#!/usr/bin/env node
// Benchmarks `/api/images/[eventId]/[kind]?w=<size>` with a real signed session cookie:
// 1. Measures direct S3 GetObject download time for 1 vehicle + 1 plate image.
// 2. Measures cold vs warm TTFB & total latency across 30 thumbnail requests (and a 50-thumbnail parallel burst).
// Usage: npm run bench:images (requires Next.js running at BENCH_BASE_URL or http://127.0.0.1:3000)
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { SignJWT } from "jose/jwt/sign";
import pg from "pg";

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

const baseUrl = (process.env.BENCH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const rawDb = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!rawDb || !process.env.SESSION_SECRET) {
  console.error("DATABASE_URL and SESSION_SECRET are required.");
  process.exit(1);
}

const dbUrl = new URL(rawDb);
const mode = dbUrl.searchParams.get("sslmode");
const ssl = mode === "require" || mode === "verify-full" || mode === "verify-ca" ? { rejectUnauthorized: true } : false;
dbUrl.searchParams.delete("sslmode");
dbUrl.searchParams.delete("channel_binding");

const pool = new pg.Pool({ connectionString: dbUrl.toString(), ssl, max: 3 });

const userRow = (
  await pool.query("SELECT id, email, name, role, password_hash FROM public.app_users WHERE is_active = true LIMIT 1")
).rows[0];
if (!userRow) {
  console.error("No active user found in app_users to mint a session cookie.");
  await pool.end();
  process.exit(1);
}

const fp = createHash("sha256").update(userRow.password_hash).digest("hex").slice(0, 16);
const jwt = await new SignJWT({
  email: userRow.email,
  name: userRow.name,
  role: userRow.role,
  fp,
})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(userRow.id)
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

const cookieHeader = `cpk_session=${jwt}`;

const eventRows = (
  await pool.query(
    `SELECT event_id, s3_bucket, vehicle_key, plate_key
     FROM public.v_events_dashboard
     WHERE vehicle_key IS NOT NULL
     ORDER BY event_time DESC NULLS LAST
     LIMIT 30`,
  )
).rows;

if (eventRows.length === 0) {
  console.error("No image events in database.");
  await pool.end();
  process.exit(1);
}

// 1. Measure single direct S3 GetObject download
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const s3 = new S3Client({
    region: process.env.AWS_REGION?.trim() || "us-east-1",
    ...(process.env.AWS_ENDPOINT_URL_S3?.trim() ? { endpoint: process.env.AWS_ENDPOINT_URL_S3.trim() } : {}),
    forcePathStyle: true,
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      httpsAgent: new https.Agent({ keepAlive: true }),
      connectionTimeout: 5_000,
      socketTimeout: 5_000,
    }),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });
  const sample = eventRows[0];
  const bucket = sample.s3_bucket?.trim() || process.env.S3_BUCKET?.trim();
  if (bucket && sample.plate_key) {
    const t0 = performance.now();
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sample.plate_key }));
    const ttfb = performance.now() - t0;
    const bytes = await out.Body.transformToByteArray();
    const total = performance.now() - t0;
    console.log(
      `[Direct S3 plate.png] bytes=${bytes.byteLength} ttfb=${ttfb.toFixed(1)}ms total=${total.toFixed(1)}ms`,
    );
  }
}

// Build 30 image URLs (cycling available events across allowed sizes if DB has < 30 rows)
const urls30 = [];
const widths = [160, 320, 640];
while (urls30.length < 30) {
  for (const row of eventRows) {
    for (const kind of ["vehicle", "plate"]) {
      if (kind === "plate" && !row.plate_key) continue;
      const w = kind === "plate" ? 320 : widths[urls30.length % widths.length];
      urls30.push(`${baseUrl}/api/images/${encodeURIComponent(row.event_id)}/${kind}?w=${w}`);
      if (urls30.length >= 30) break;
    }
    if (urls30.length >= 30) break;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function measureOne(url, extraHeaders = {}) {
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { Cookie: cookieHeader, ...extraHeaders },
    redirect: "manual",
  });
  const ttfb = performance.now() - t0;
  const buf = await res.arrayBuffer();
  const total = performance.now() - t0;
  return {
    status: res.status,
    bytes: buf.byteLength,
    ttfb,
    total,
    etag: res.headers.get("etag"),
    serverTiming: res.headers.get("server-timing") || "",
  };
}

console.log(`\n--- Pass 1 (initial / cold-or-warming pass, ${urls30.length} requests) ---`);
const pass1 = [];
for (const u of urls30) {
  pass1.push(await measureOne(u));
}
const p1Ttfb = pass1.map((r) => r.ttfb).sort((a, b) => a - b);
const p1Total = pass1.map((r) => r.total).sort((a, b) => a - b);
console.log(
  `Pass 1 statuses=${JSON.stringify(Object.groupBy ? Object.fromEntries(Object.entries(Object.groupBy(pass1, (x) => x.status)).map(([k, v]) => [k, v.length])) : pass1[0]?.status)} TTFB p50=${percentile(p1Ttfb, 50).toFixed(1)}ms p95=${percentile(p1Ttfb, 95).toFixed(1)}ms max=${percentile(p1Ttfb, 100).toFixed(1)}ms | Total p50=${percentile(p1Total, 50).toFixed(1)}ms max=${percentile(p1Total, 100).toFixed(1)}ms`,
);
console.log(`Sample Server-Timing (pass 1[0]): ${pass1[0]?.serverTiming}`);

console.log(`\n--- Pass 2 (WARM disk cache sequential, 30 requests) ---`);
const pass2 = [];
for (const u of urls30) {
  pass2.push(await measureOne(u));
}
const p2Ttfb = pass2.map((r) => r.ttfb).sort((a, b) => a - b);
const p2Total = pass2.map((r) => r.total).sort((a, b) => a - b);
console.log(
  `Warm 30 sequential: TTFB p50=${percentile(p2Ttfb, 50).toFixed(1)}ms p95=${percentile(p2Ttfb, 95).toFixed(1)}ms max=${percentile(p2Ttfb, 100).toFixed(1)}ms | Total p50=${percentile(p2Total, 50).toFixed(1)}ms p95=${percentile(p2Total, 95).toFixed(1)}ms | avgBytes=${Math.round(pass2.reduce((s, r) => s + r.bytes, 0) / pass2.length)}B`,
);
console.log(`Sample Server-Timing (warm[0]): ${pass2[0]?.serverTiming}`);

console.log(`\n--- Pass 3 (WARM ETag If-None-Match 304 check) ---`);
if (pass2[0]?.etag) {
  const reval = await measureOne(urls30[0], { "If-None-Match": pass2[0].etag });
  console.log(`304 check: status=${reval.status} ttfb=${reval.ttfb.toFixed(1)}ms serverTiming=${reval.serverTiming}`);
}

console.log(`\n--- Pass 4 (50-thumbnail page parallel burst) ---`);
const urls50 = Array.from({ length: 50 }, (_, i) => urls30[i % urls30.length]);
const tBurst0 = performance.now();
const burstResults = await Promise.all(urls50.map((u) => measureOne(u)));
const burstWallMs = performance.now() - tBurst0;
const bTtfb = burstResults.map((r) => r.ttfb).sort((a, b) => a - b);
console.log(
  `50 parallel thumbnails: wallTime=${burstWallMs.toFixed(1)}ms (<1000ms target: ${burstWallMs < 1000 ? "PASS" : "SLOW"}), TTFB p50=${percentile(bTtfb, 50).toFixed(1)}ms p95=${percentile(bTtfb, 95).toFixed(1)}ms`,
);

await pool.end();
