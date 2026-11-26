#!/usr/bin/env node
// Automated invariant checks required by the Phase 6 checklist:
// 1. No per-event DELETE/TRUNCATE anywhere in `src/` — SQL DELETE/TRUNCATE and HTTP DELETE routes
//    may only appear in empty-database, watchlist removal, and pipeline stream removal.
// 2. No NEXT_PUBLIC_ environment variables anywhere.
// 3. `.env.local.example` contains every required variable name with blank values.
// 4. No component/page/lib imports `src/data/mock-data.ts`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const ALLOWED_DESTRUCTIVE_FILES = new Set([
  "src/app/api/admin/empty-database/route.ts",
  "src/components/settings/DangerZoneSettings.tsx",
  "src/app/api/watchlist/[id]/route.ts",
  "src/components/settings/WatchlistSettings.tsx",
  "src/app/api/pipeline/streams/[id]/route.ts",
  "src/components/settings/CameraSettings.tsx",
  "src/lib/s3.ts",
]);

for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8");

  if (/NEXT_PUBLIC_[A-Z0-9_]+/.test(content)) {
    errors.push(`${rel}: forbidden NEXT_PUBLIC_ variable reference.`);
  }

  if (!rel.startsWith("src/data/") && /from\s+["']@\/data\/mock-data["']/.test(content)) {
    errors.push(`${rel}: forbidden import of @/data/mock-data.`);
  }

  const hasDestructiveSqlOrRoute =
    /\bTRUNCATE\b/.test(content) ||
    /\bTRUNCATE\s+TABLE\b/i.test(content) ||
    /\bDELETE\s+FROM\b/i.test(content) ||
    /export\s+async\s+function\s+DELETE\b/.test(content) ||
    /method:\s*["']DELETE["']/.test(content);

  if (hasDestructiveSqlOrRoute && !ALLOWED_DESTRUCTIVE_FILES.has(rel)) {
    errors.push(`${rel}: unexpected DELETE/TRUNCATE outside allowed admin/watchlist/stream files.`);
  }
}

const envExample = readFileSync(join(root, ".env.local.example"), "utf8");
const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "PIPELINE_URL",
  "PIPELINE_TOKEN",
  "SESSION_SECRET",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_ENDPOINT_URL_S3",
  "S3_BUCKET",
  "CACHE_DIR",
  "IMAGE_CACHE_MAX_MB",
  "LIVE_PIPELINE_EVENTS",
];

for (const key of REQUIRED_ENV_KEYS) {
  const lineRegex = new RegExp(`^${key}=(.*)$`, "m");
  const match = envExample.match(lineRegex);
  if (!match) {
    errors.push(`.env.local.example: missing ${key}=`);
  } else if (match[1].trim() !== "") {
    errors.push(`.env.local.example: ${key} must have an empty value.`);
  }
}

if (errors.length > 0) {
  for (const err of errors) console.error(`FAIL: ${err}`);
  process.exit(1);
}
console.log("All security and deletion constraints verified.");
