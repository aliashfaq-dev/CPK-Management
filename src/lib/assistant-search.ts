import { z } from "zod";
import { getCameras, getDetectionsPage, getFilteredSummary } from "@/lib/data-service";
import { normalizePlate, parseUtcDate } from "@/lib/detection-query";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import type { AssistantReply } from "@/lib/assistant";
import type { Camera, DetectionFilters } from "@/types";

/**
 * Gemini structured-filter assistant (server-only).
 *
 * Security invariants:
 * 1. Gemini receives ONLY the user's question, current UTC timestamp, and static schema/camera enums —
 *    NEVER database rows.
 * 2. Gemini outputs ONLY structured filter JSON validated by Zod (`assistantFilterSchema`) — NEVER SQL.
 * 3. Validated fields are bound into parameterized queries in `data-service.ts`.
 * 4. `GEMINI_API_KEY` stays strictly on the server (sent via `x-goog-api-key` header, 15s timeout).
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 15_000;

const URDU_HINT =
  /\b(kya|kahan|dikhao|dikha|mujhe|gaari|gari|gaadi|aaj|kal|safed|kala|neela|laal|hai|hain|mein|ki|ka|ke|ko|se|par|talash|dhoondo|dhundo|wali|wala|kitni|kitne|batao|batayein|kul)\b/i;

export const assistantFilterSchema = z.object({
  intent: z.enum(["search", "count", "summary"]),
  language: z.enum(["en", "roman_urdu"]).optional(),
  plate: z.string().trim().max(24).nullable().optional(),
  vehicle_type: z.enum(["car", "rickshaw", "htv", "van", "pickup", "bike"]).nullable().optional(),
  colour: z.string().trim().max(40).nullable().optional(),
  camera: z.string().trim().max(80).nullable().optional(),
  from: z.string().trim().max(40).nullable().optional(),
  to: z.string().trim().max(40).nullable().optional(),
  has_plate: z.boolean().nullable().optional(),
  limit: z.number().int().min(1).max(20).nullable().optional(),
});

type StructuredAssistantQuery = z.infer<typeof assistantFilterSchema>;

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["search", "count", "summary"] },
    language: { type: "STRING", enum: ["en", "roman_urdu"] },
    plate: { type: "STRING", nullable: true },
    vehicle_type: { type: "STRING", enum: ["car", "rickshaw", "htv", "van", "pickup", "bike"], nullable: true },
    colour: { type: "STRING", nullable: true },
    camera: { type: "STRING", nullable: true },
    from: { type: "STRING", nullable: true },
    to: { type: "STRING", nullable: true },
    has_plate: { type: "BOOLEAN", nullable: true },
    limit: { type: "INTEGER", nullable: true },
  },
  required: ["intent", "language"],
};

function safeFallbackReply(urdu: boolean, reason: "unconfigured" | "unclear" | "unavailable"): AssistantReply {
  if (reason === "unconfigured") {
    return {
      text: urdu
        ? "Assistant abhi configure nahi hai (server par GEMINI_API_KEY set nahi hai). Tab tak upar ke filters se search karein."
        : "The assistant is not configured on the server (GEMINI_API_KEY is not set). Use the table filters to search detections.",
      results: [],
      total: 0,
    };
  }
  if (reason === "unavailable") {
    return {
      text: urdu
        ? "Assistant se abhi jawab nahi mil saka. Kuch dair baad dobara koshish karein ya table filters istemal karein."
        : "The assistant could not process that request right now. Try again shortly or use the table filters.",
      results: [],
      total: 0,
    };
  }
  return {
    text: urdu
      ? "Search ke liye koi detail batayein — jaise plate number, gaari ki type (car, rickshaw, htv, van, pickup, bike), colour, camera, ya waqt (aaj, kal)."
      : "Include at least one detail to search: a plate number, vehicle type (car, rickshaw, htv, van, pickup, bike), colour, camera, or time range.",
    results: [],
    total: 0,
  };
}

function resolveCameraId(raw: string | null | undefined, cameras: Camera[]): { id: string; label: string } | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const exact = cameras.find((c) => c.id.toLowerCase() === lower);
  if (exact) return { id: exact.id, label: exact.name };
  const byName = cameras.filter(
    (c) => c.name.toLowerCase().includes(lower) || c.location.toLowerCase().includes(lower),
  );
  if (byName.length === 1) return { id: byName[0].id, label: byName[0].name };
  return null;
}

function hrefForFilters(filters: DetectionFilters): string {
  const params = new URLSearchParams();
  if (filters.plate) params.set("q", filters.plate);
  if (filters.type) params.set("type", filters.type);
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.colour) params.set("colour", filters.colour);
  if (filters.from) params.set("from", filters.from.slice(0, 10));
  if (filters.to) {
    const inclusiveEnd = new Date(Math.max(Date.parse(filters.from ?? filters.to), Date.parse(filters.to) - 86_400_000));
    params.set("to", inclusiveEnd.toISOString().slice(0, 10));
  }
  if (filters.hasPlate !== undefined) params.set("hasPlate", filters.hasPlate ? "yes" : "no");
  const qs = params.toString();
  return qs ? `/detections?${qs}` : "/detections";
}

async function extractFiltersWithGemini(
  question: string,
  cameras: Camera[],
): Promise<{ ok: true; data: StructuredAssistantQuery } | { ok: false; reason: "unconfigured" | "unavailable" }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "unconfigured" };
  }
  const model = (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(/[^a-zA-Z0-9._-]/g, "");
  const nowIso = new Date().toISOString();
  const cameraList = cameras.slice(0, 50).map((c) => `${c.id} (${c.name}, ${c.location})`).join("; ") || "none registered";

  const systemInstruction = [
    "You convert a user's vehicle-detection question (in English or Roman Urdu) into a JSON filter object.",
    `Current UTC time: ${nowIso}.`,
    `Allowed vehicle_type values ONLY: ${VEHICLE_TYPES.join(", ")}. Map motorcycle/motorbike -> bike; truck/bus/trailer/lorry -> htv; riksha/chingchi -> rickshaw.`,
    "Translate Roman Urdu colours to English colour names (safed->White, kala->Black, laal->Red, neela->Blue, hara->Green, peela->Yellow).",
    `Registered cameras: ${cameraList}. Set "camera" to the exact camera_id when one matches, else null.`,
    'For "from" and "to", emit ISO-8601 UTC timestamps (e.g. 2026-11-26T00:00:00Z) or YYYY-MM-DD when the user mentions a time window ("today"/"aaj", "yesterday"/"kal", "last hour"/"pichla ghanta"). Note "to" is exclusive when an exact timestamp is given, or YYYY-MM-DD for a calendar date.',
    'Set intent="count" when the user asks how many ("kitni", "how many", "count"), intent="summary" when asking for an overview/breakdown ("summary", "kaisa raha", "breakdown"), otherwise intent="search".',
    'Set language="roman_urdu" when the user writes in Roman Urdu/Urdu, otherwise "en".',
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(
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
            maxOutputTokens: 300,
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!rawText) return { ok: false, reason: "unavailable" };
    const parsedJson: unknown = JSON.parse(rawText);
    const validated = assistantFilterSchema.safeParse(parsedJson);
    if (!validated.success) return { ok: false, reason: "unavailable" };
    return { ok: true, data: validated.data };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function answerAssistantQuestion(question: string): Promise<AssistantReply> {
  const fallbackUrdu = URDU_HINT.test(question);
  const cameras = await getCameras();

  const extracted = await extractFiltersWithGemini(question, cameras);
  if (!extracted.ok) {
    return safeFallbackReply(fallbackUrdu, extracted.reason);
  }

  const structured = extracted.data;
  const urdu = structured.language === "roman_urdu" || fallbackUrdu;
  const filters: DetectionFilters = {};
  const parts: string[] = [];

  if (structured.plate) {
    const norm = normalizePlate(structured.plate);
    if (norm) {
      filters.plate = norm.slice(0, 15);
      parts.push(`plate ${filters.plate}`);
    }
  }
  if (structured.vehicle_type) {
    filters.type = structured.vehicle_type;
    parts.push(VEHICLE_TYPE_LABELS[structured.vehicle_type]);
  }
  if (structured.colour) {
    const cleanColour = structured.colour.replace(/[^a-zA-Z\s-]/g, "").trim();
    if (cleanColour) {
      filters.colour = cleanColour.slice(0, 30);
      parts.push(filters.colour.toLowerCase());
    }
  }
  const resolvedCam = resolveCameraId(structured.camera, cameras);
  if (resolvedCam) {
    filters.camera = resolvedCam.id;
    parts.push(resolvedCam.label);
  }
  if (structured.from) {
    const fromIso = parseUtcDate(structured.from, false);
    if (fromIso) {
      filters.from = fromIso;
      parts.push(`from ${fromIso.slice(0, 16).replace("T", " ")} UTC`);
    }
  }
  if (structured.to) {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(structured.to);
    const toIso = parseUtcDate(structured.to, isDateOnly);
    if (toIso) {
      filters.to = toIso;
      parts.push(`to ${toIso.slice(0, 16).replace("T", " ")} UTC`);
    }
  }
  if (typeof structured.has_plate === "boolean") {
    filters.hasPlate = structured.has_plate;
    parts.push(structured.has_plate ? (urdu ? "plate ke sath" : "with plate") : (urdu ? "bina plate" : "without plate"));
  }

  const hasAnyFilter = Object.values(filters).some((v) => v !== undefined);
  if (!hasAnyFilter && structured.intent === "search") {
    return safeFallbackReply(urdu, "unclear");
  }

  const limit = Math.min(10, Math.max(1, structured.limit ?? 5));
  const filterLabel = parts.join(", ") || (urdu ? "sab records" : "all records");
  const href = hrefForFilters(filters);

  if (structured.intent === "summary") {
    const [summary, recentPage] = await Promise.all([
      getFilteredSummary(filters),
      getDetectionsPage({ ...filters, page: 1, pageSize: 5, sort: "detectedAt", dir: "desc" }),
    ]);
    if (summary.total === 0) {
      return {
        text: urdu
          ? `${filterLabel} ke liye koi detection record nahi mila.`
          : `No detections matched ${filterLabel}.`,
        results: [],
        total: 0,
      };
    }
    const breakdown = VEHICLE_TYPES.filter((t) => summary.byType[t] > 0)
      .map((t) => `${VEHICLE_TYPE_LABELS[t]}: ${summary.byType[t]}`)
      .join(", ");
    return {
      text: urdu
        ? `Kul ${summary.total} detections mili (${filterLabel}) — plate read: ${summary.withPlate}. Iqsaam: ${breakdown}.`
        : `Summary for ${filterLabel}: ${summary.total} total detections (${summary.withPlate} with readable plates). Breakdown: ${breakdown}.`,
      results: recentPage.rows,
      total: summary.total,
      href,
    };
  }

  const page = await getDetectionsPage({
    ...filters,
    page: 1,
    pageSize: limit,
    sort: "detectedAt",
    dir: "desc",
  });

  if (page.total === 0) {
    return {
      text: urdu
        ? `“${filterLabel}” ke liye koi detection nahi mili. Plate ya time range badal kar dobara dekhein.`
        : `No detections found for ${filterLabel}. Check the plate or widen the time range.`,
      results: [],
      total: 0,
    };
  }

  if (structured.intent === "count") {
    return {
      text: urdu
        ? `${filterLabel} ke liye kul ${page.total} detection${page.total === 1 ? "" : "s"} darj hain. Taza tareen ${page.rows.length} neeche hain.`
        : `There ${page.total === 1 ? "is" : "are"} ${page.total} detection${page.total === 1 ? "" : "s"} matching ${filterLabel}. Showing the ${page.rows.length} most recent.`,
      results: page.rows,
      total: page.total,
      href,
    };
  }

  return {
    text: urdu
      ? `${page.total} detection mili (${filterLabel}). Sab se nayi ${page.rows.length} neeche dikhayi gayi hain.`
      : `Found ${page.total} detection${page.total === 1 ? "" : "s"} for ${filterLabel}. Showing the ${page.rows.length} most recent.`,
    results: page.rows,
    total: page.total,
    href,
  };
}
