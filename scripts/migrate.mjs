#!/usr/bin/env node
// Applies sql/frontend.sql to the database in DATABASE_URL_DIRECT (or DATABASE_URL).
// Usage: npm run db:migrate
// Reads .env.local if present. Never prints connection details.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const file = join(root, name);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const raw = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
  process.exit(1);
}

const url = new URL(raw);
const mode = url.searchParams.get("sslmode");
const ssl = mode === "require" || mode === "verify-full" || mode === "verify-ca" ? { rejectUnauthorized: true } : false;
url.searchParams.delete("sslmode");
url.searchParams.delete("channel_binding");

const sql = readFileSync(join(root, "sql", "frontend.sql"), "utf8");
const client = new pg.Client({ connectionString: url.toString(), ssl });

try {
  await client.connect();
  await client.query(sql);
  console.log("sql/frontend.sql applied.");
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
