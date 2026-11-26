import {
  AI_VEHICLE_LABELS,
  AI_VEHICLE_TYPES,
  AiFilterValidationError,
  buildAppliedFilterChips,
  buildGeminiSystemPrompt,
  buildParameterizedSearchPlan,
  GEMINI_FILTER_RESPONSE_SCHEMA,
  hasSubstantiveFilter,
  normalizeQuestionCacheKey,
  toHistoryWire,
  validateAndNormalizeAiFilters,
  type AiVehicleType,
  type CameraRef,
  type RawAiFilter,
  type ValidatedAiFilters,
} from "@/lib/ai-search-core";
import type { AssistantGroupRow, AssistantReply } from "@/lib/assistant";
import { getCameras, rowToDetection } from "@/lib/data-service";
import { query } from "@/lib/db";

/**
 * Gemini AI-only search orchestrator (server-only).
 *
 * - Uses `GeminiFilterClient` (real HTTP Gemini with 15s timeout + 1 retry in production;
 *   swappable with a fake client in deterministic tests).
 * - Caches normalized `(question + last3History) -> ValidatedAiFilters` for 5 minutes.
 * - Caches `(canonical ValidatedAiFilters + pgTrgm) -> AssistantReply` for 30 seconds.
 * - Runs independent SQL count, group, and row queries in parallel (`Promise.all`).
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 15_000;
const QUESTION_CACHE_TTL_MS = 5 * 60_000;
const RESULT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 500;

const URDU_HINT =
  /\b(kya|kahan|dikhao|dikha|mujhe|gaari|gari|gaadi|aaj|kal|safed|kala|neela|laal|hai|hain|mein|ki|ka|ke|ko|se|par|talash|dhoondo|dhundo|wali|wala|kitni|kitne|batao|batayein|kul|unmein|raat|hafte|ghante)\b/i;

export interface GeminiExtractRequest {
  question: string;
  now: Date;
  cameras: readonly CameraRef[];
  history: readonly RawAiFilter[];
}

export interface GeminiFilterClient {
  extractFilters(req: GeminiExtractRequest): Promise<unknown>;
}

export class GeminiUnavailableError extends Error {
  constructor(message = "AI search unavailable") {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  systemInstruction: string,
  question: string,
): Promise<unknown> {
  const response = await fetch(
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
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new GeminiUnavailableError(`Gemini HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!rawText) {
    throw new GeminiUnavailableError("Empty Gemini candidate");
  }
  return JSON.parse(rawText) as unknown;
}

export const httpGeminiClient: GeminiFilterClient = {
  async extractFilters({ question, now, cameras, history }) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new GeminiUnavailableError("GEMINI_API_KEY not configured");
    }
    const model = (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(
      /[^a-zA-Z0-9._-]/g,
      "",
    );
    const systemPrompt = buildGeminiSystemPrompt(now, cameras, history);

    // 1 retry on transient timeout/5xx/parse failure
    try {
      return await callGeminiOnce(apiKey, model, systemPrompt, question);
    } catch {
      return await callGeminiOnce(apiKey, model, systemPrompt, question);
    }
  },
};

interface TimedEntry<T> {
  value: T;
  expiresAt: number;
}

interface AiSearchCacheStore {
  questionCache: Map<string, TimedEntry<ValidatedAiFilters>>;
  resultCache: Map<string, TimedEntry<AssistantReply>>;
  pgTrgm?: boolean;
}

interface AiGlobals {
  __cpkAiSearch?: AiSearchCacheStore;
}
const globalStore = globalThis as typeof globalThis & AiGlobals;

function getCacheStore(): AiSearchCacheStore {
  if (!globalStore.__cpkAiSearch) {
    globalStore.__cpkAiSearch = {
      questionCache: new Map(),
      resultCache: new Map(),
    };
  }
  return globalStore.__cpkAiSearch;
}

function getCached<T>(map: Map<string, TimedEntry<T>>, key: string): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function setCached<T>(map: Map<string, TimedEntry<T>>, key: string, value: T, ttlMs: number): void {
  map.delete(key);
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (map.size > MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
}

async function detectPgTrgm(): Promise<boolean> {
  const store = getCacheStore();
  if (store.pgTrgm !== undefined) return store.pgTrgm;
  try {
    const res = await query<{ ok: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS ok",
    );
    store.pgTrgm = Boolean(res.rows[0]?.ok);
  } catch {
    store.pgTrgm = false;
  }
  return store.pgTrgm;
}

function buildFilterUrlParams(filters: ValidatedAiFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.plate) {
    params.set("q", filters.plate);
    params.set("plateMode", filters.plateMode);
  }
  if (filters.vehicleTypes.length === 1) {
    params.set("type", filters.vehicleTypes[0]);
  } else if (filters.vehicleTypes.length > 1) {
    params.set("types", filters.vehicleTypes.join(","));
  }
  if (filters.colours.length === 1) {
    params.set("colour", filters.colours[0]);
  } else if (filters.colours.length > 1) {
    params.set("colours", filters.colours.join(","));
  }
  if (filters.make) params.set("make", filters.make);
  if (filters.model) params.set("model", filters.model);
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.hasPlate !== undefined) params.set("hasPlate", filters.hasPlate ? "yes" : "no");
  if (filters.minConfidence !== undefined) params.set("minConfidence", String(filters.minConfidence));
  return params;
}

function unavailableReply(urdu: boolean): AssistantReply {
  return {
    text: urdu
      ? "AI search abhi available nahi — server par GEMINI_API_KEY check karein ya thori dair baad dobara koshish karein."
      : "AI search abhi available nahi (AI search is currently unavailable — verify GEMINI_API_KEY on the server or try again shortly).",
    results: [],
    total: 0,
    chips: [],
    unavailable: true,
  };
}

export async function answerAssistantQuestion(
  question: string,
  rawHistory: readonly RawAiFilter[] = [],
  options: {
    client?: GeminiFilterClient;
    now?: Date;
    bypassCache?: boolean;
  } = {},
): Promise<AssistantReply> {
  const fallbackUrdu = URDU_HINT.test(question);
  const store = getCacheStore();
  const now = options.now ?? new Date();
  const client = options.client ?? httpGeminiClient;

  const [cameras, pgTrgm] = await Promise.all([getCameras(), detectPgTrgm()]);

  // Re-validate up to the last 3 previous filter turns so invalid client state is ignored.
  const validHistory: ValidatedAiFilters[] = [];
  for (const item of rawHistory.slice(-3)) {
    try {
      validHistory.push(validateAndNormalizeAiFilters(item, cameras));
    } catch {
      /* ignore malformed client history entry */
    }
  }
  const wireHistory = validHistory.map(toHistoryWire);
  const previousTurn = validHistory[validHistory.length - 1];

  const qKey = normalizeQuestionCacheKey(question, wireHistory);
  let filters = options.bypassCache ? undefined : getCached(store.questionCache, qKey);

  if (!filters) {
    let rawGeminiOutput: unknown;
    try {
      rawGeminiOutput = await client.extractFilters({
        question,
        now,
        cameras,
        history: wireHistory,
      });
    } catch {
      return unavailableReply(fallbackUrdu);
    }

    try {
      filters = validateAndNormalizeAiFilters(rawGeminiOutput, cameras, previousTurn);
    } catch (error) {
      if (error instanceof AiFilterValidationError) {
        return {
          text: fallbackUrdu
            ? `Sawal ki filter conditions durust nahi hain (${error.message}). Naya sawal likh kar dobara koshish karein.`
            : `Could not run that search (${error.message}). Rephrase your question within a 1-year date range.`,
          results: [],
          total: 0,
          chips: [],
        };
      }
      return unavailableReply(fallbackUrdu);
    }

    if (!options.bypassCache) {
      setCached(store.questionCache, qKey, filters, QUESTION_CACHE_TTL_MS);
    }
  }

  const urdu = filters.language === "roman_urdu" || fallbackUrdu;
  const chips = buildAppliedFilterChips(filters);
  const appliedFilter = toHistoryWire(filters);

  if (!hasSubstantiveFilter(filters) && filters.intent === "search") {
    return {
      text: urdu
        ? "Search ke liye koi detail likhein — jaise plate number, gaari ki qisam (car, rickshaw, htv, van, pickup, bike), rang, camera, ya waqt (aaj, kal, pichle 2 ghante)."
        : "Describe what to search for — a plate number, vehicle type (car, rickshaw, htv, van, pickup, bike), colour, make, camera, or time window.",
      results: [],
      total: 0,
      chips,
      appliedFilter,
    };
  }

  const resultCacheKey = `${pgTrgm ? "trgm1" : "trgm0"}:${JSON.stringify(appliedFilter)}`;
  if (!options.bypassCache) {
    const cachedReply = getCached(store.resultCache, resultCacheKey);
    if (cachedReply) {
      return cachedReply;
    }
  }

  const plan = buildParameterizedSearchPlan(filters, { pgTrgm });
  const qs = buildFilterUrlParams(filters).toString();
  const href = qs ? `/detections?${qs}` : "/detections";
  const exportHref = qs ? `/api/detections/export?${qs}` : "/api/detections/export";

  let reply: AssistantReply;

  if (filters.intent === "summary") {
    const withPlateJoiner = plan.whereClause ? `${plan.whereClause} AND v.has_plate` : "WHERE v.has_plate";
    const [countRes, withPlateRes, byTypeRes, rowsRes] = await Promise.all([
      query<{ total: number }>(plan.countSql.text, plan.countSql.params),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.v_events_dashboard v ${withPlateJoiner}`,
        plan.countSql.params,
      ),
      query<{ label: string; count: number }>(
        `SELECT v.vehicle_type AS label, COUNT(*)::int AS count
         FROM public.v_events_dashboard v ${plan.whereClause}
         GROUP BY v.vehicle_type ORDER BY count DESC`,
        plan.countSql.params,
      ),
      query<Record<string, unknown>>(plan.rowsSql.text, plan.rowsSql.params),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const withPlate = Number(withPlateRes.rows[0]?.total ?? 0);
    const results = rowsRes.rows.map(rowToDetection);
    const groups: AssistantGroupRow[] = byTypeRes.rows.map((r) => ({
      label: AI_VEHICLE_LABELS[r.label as AiVehicleType] ?? r.label,
      count: Number(r.count),
    }));

    if (total === 0) {
      reply = {
        text: urdu ? "Is muddat/filter ke liye koi detection record nahi mila." : "No detections matched this summary filter.",
        results: [],
        total: 0,
        chips,
        appliedFilter,
      };
    } else {
      const breakdown = groups.map((g) => `${g.label}: ${g.count}`).join(", ");
      const typesPresent = AI_VEHICLE_TYPES.length;
      void typesPresent;
      reply = {
        text: urdu
          ? `Kul ${total} detections mili (plate read: ${withPlate}). Tafseel: ${breakdown}.`
          : `Summary: ${total} detections (${withPlate} with readable plates). Breakdown: ${breakdown}.`,
        results,
        total,
        chips,
        groups,
        appliedFilter,
        href,
        exportHref,
      };
    }
  } else if (
    (filters.intent === "group_by_camera" ||
      filters.intent === "group_by_type" ||
      filters.intent === "top_plates") &&
    plan.groupSql
  ) {
    const [countRes, groupRes, rowsRes] = await Promise.all([
      query<{ total: number }>(plan.countSql.text, plan.countSql.params),
      query<{ label: string; count: number }>(plan.groupSql.text, plan.groupSql.params),
      query<Record<string, unknown>>(plan.rowsSql.text, plan.rowsSql.params),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const results = rowsRes.rows.map(rowToDetection);
    const groups: AssistantGroupRow[] = groupRes.rows.map((r) => ({
      label:
        filters.intent === "group_by_type"
          ? (AI_VEHICLE_LABELS[r.label as AiVehicleType] ?? r.label)
          : String(r.label),
      count: Number(r.count),
    }));

    if (groups.length === 0) {
      reply = {
        text: urdu ? "In filters ke mutabiq koi record nahi mila." : "No matching records found for that grouping.",
        results: [],
        total: 0,
        chips,
        appliedFilter,
      };
    } else {
      const topSummary = groups
        .slice(0, 4)
        .map((g) => `${g.label} (${g.count})`)
        .join(", ");
      reply = {
        text: urdu
          ? `Kul ${total} detections — numayan nataij: ${topSummary}.`
          : `${total} total detections — top results: ${topSummary}.`,
        results,
        total,
        chips,
        groups,
        appliedFilter,
        href,
        exportHref,
      };
    }
  } else {
    const [countRes, rowsRes] = await Promise.all([
      query<{ total: number }>(plan.countSql.text, plan.countSql.params),
      query<Record<string, unknown>>(plan.rowsSql.text, plan.rowsSql.params),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const results = rowsRes.rows.map(rowToDetection);

    if (total === 0) {
      reply = {
        text: urdu
          ? "In filters ke mutabiq koi detection nahi mili. Naya sawal likh kar dobara dekhein."
          : "No detections matched these filters. Try phrasing a broader search.",
        results: [],
        total: 0,
        chips,
        appliedFilter,
      };
    } else if (filters.intent === "count") {
      reply = {
        text: urdu
          ? `Kul ${total} detection${total === 1 ? "" : "s"} mili hain.`
          : `Matched ${total} detection${total === 1 ? "" : "s"}.`,
        results: results.slice(0, 5),
        total,
        chips,
        appliedFilter,
        href,
        exportHref,
      };
    } else if (filters.intent === "timeline_of_plate") {
      reply = {
        text: urdu
          ? `Plate ${filters.plate ?? ""} ki ${total} sightings mili hain (waqt ki tarteeb se neeche hain).`
          : `Found ${total} sighting${total === 1 ? "" : "s"} in chronological order.`,
        results,
        total,
        chips,
        appliedFilter,
        href,
        exportHref,
      };
    } else {
      reply = {
        text: urdu
          ? `${total} detection${total === 1 ? "" : "s"} mili — taza tareen ${results.length} neeche dikhayi gayi hain.`
          : `Found ${total} detection${total === 1 ? "" : "s"} — showing ${results.length}.`,
        results,
        total,
        chips,
        appliedFilter,
        href,
        exportHref,
      };
    }
  }

  if (!options.bypassCache) {
    setCached(store.resultCache, resultCacheKey, reply, RESULT_CACHE_TTL_MS);
  }
  return reply;
}
