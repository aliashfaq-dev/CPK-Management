#!/usr/bin/env node
// Live smoke test sending 10 English + Roman Urdu questions to the real Gemini API
// when `GEMINI_API_KEY` is configured in `.env.local` or `.env`.
// Usage: npm run test:ai-live
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  buildGeminiSystemPrompt,
  GEMINI_FILTER_RESPONSE_SCHEMA,
  toHistoryWire,
  validateAndNormalizeAiFilters,
} from "../src/lib/ai-search-core.ts";

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

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.log("GEMINI_API_KEY is not set in .env.local / .env — skipping live Gemini calls.");
  console.log("Add GEMINI_API_KEY and re-run `npm run test:ai-live` to inspect live filter extraction.");
  process.exit(0);
}

const model = (process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash").replace(/[^a-zA-Z0-9._-]/g, "");
const cameras = [
  { id: "CAM-00001", name: "Camera 1", location: "Main Gate" },
  { id: "CAM-00002", name: "Clifton Bridge", location: "Clifton" },
];

const QUESTIONS = [
  "aaj safed car kitni aayin?",
  "show rickshaws in the last 2 hours",
  "unmein se bina plate wali dikhao",
  "timeline of plate HR26CQ6869",
  "kal raat ko htv ya pickup",
  "top 5 plates this week",
  "kis camera par sab se zyada gaariyan aayin",
  "plates similar to 8KL-2B47",
  "breakdown by vehicle type today",
  "aaj ka overall summary batao",
];

const latencies = [];
const history = [];

for (const question of QUESTIONS) {
  const now = new Date();
  const systemInstruction = buildGeminiSystemPrompt(now, cameras, history);
  const t0 = performance.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
          responseSchema: GEMINI_FILTER_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const ms = performance.now() - t0;
  latencies.push(ms);

  if (!res.ok) {
    console.error(`FAIL [${res.status}] "${question}" (${ms.toFixed(0)}ms)`);
    process.exitCode = 1;
    continue;
  }

  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text);
  const prev = history.length > 0 ? validateAndNormalizeAiFilters(history[history.length - 1], cameras) : undefined;
  const validated = validateAndNormalizeAiFilters(parsed, cameras, prev);
  const wire = toHistoryWire(validated);
  history.push(wire);
  if (history.length > 3) history.shift();
  console.log(`OK (${ms.toFixed(0)}ms) "${question}" -> ${JSON.stringify(wire)}`);
}

latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
console.log(`\nCompleted ${latencies.length} live Gemini calls | p50=${p50.toFixed(0)}ms`);
