import { getCameras, getDetectionsPage } from "@/lib/data-service";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import type { AssistantReply } from "@/lib/assistant";
import type { Camera, DetectionFilters, VehicleType } from "@/types";

/**
 * Server-side assistant search. `ruleBasedFilters` is an interim keyword parser (English and
 * Roman Urdu) that is replaced by the Gemini filter extractor in the assistant phase. Either way the
 * result is a `DetectionFilters` object, and only that reaches the parameterized SQL in data-service.
 */

const TYPE_WORDS: Record<VehicleType, string[]> = {
  car: ["car", "cars", "gaari", "gari", "gaadi", "sedan", "suv"],
  rickshaw: ["rickshaw", "rickshaws", "riksha", "rikshaw", "chingchi"],
  htv: ["htv", "truck", "trucks", "lorry", "bus", "buses", "trailer"],
  van: ["van", "vans", "hiace"],
  pickup: ["pickup", "pickups", "suzuki-pickup", "loader"],
  bike: ["bike", "bikes", "motorcycle", "motorcycles", "motorbike"],
};

const COLOR_WORDS: Record<string, string[]> = {
  white: ["white", "safed", "safaid"],
  black: ["black", "kala", "kali"],
  silver: ["silver"],
  grey: ["grey", "gray"],
  blue: ["blue", "neela", "nila"],
  red: ["red", "laal", "lal"],
  green: ["green", "hara"],
};

const URDU_HINT = /\b(kya|kahan|dikhao|dikha|mujhe|gaari|gari|gaadi|aaj|kal|safed|kala|neela|laal|hai|mein|ki|ka|ko|talash|dhoondo|dhundo|wali|wala)\b/i;
const PLATE = /\b([a-z]{2,3})[\s-]?(\d{3,4})\b/i;
const STOP_TOKENS = new Set(["block", "road", "junction", "gate", "bridge", "entrance", "approach", "terminal", "checkpoint", "plaza", "sector"]);

export interface ParsedQuestion {
  filters: DetectionFilters;
  labels: string[];
  urdu: boolean;
}

function cameraTokens(camera: Camera): string[] {
  return `${camera.name} ${camera.location}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 5 && !STOP_TOKENS.has(token));
}

export function ruleBasedFilters(question: string, cameras: Camera[]): ParsedQuestion {
  const lower = question.toLowerCase();
  const tokens = lower.split(/[^a-z0-9-]+/).filter(Boolean);
  const urdu = URDU_HINT.test(question);
  const filters: DetectionFilters = {};
  const labels: string[] = [];

  const plate = question.match(PLATE);
  if (plate) {
    filters.plate = `${plate[1]}${plate[2]}`.toUpperCase();
    labels.push(`plate ${plate[1].toUpperCase()}-${plate[2]}`);
  }
  const type = (Object.keys(TYPE_WORDS) as VehicleType[]).find((t) => TYPE_WORDS[t].some((word) => tokens.includes(word)));
  if (type) {
    filters.type = type;
    labels.push(VEHICLE_TYPE_LABELS[type].toLowerCase());
  }
  const colour = Object.keys(COLOR_WORDS).find((c) => COLOR_WORDS[c].some((word) => tokens.includes(word)));
  if (colour) {
    filters.colour = colour;
    labels.push(colour);
  }
  const camNumber = lower.match(/\bcam[\s-]?0*(\d+)\b/);
  const matched = cameras.filter((c) => (camNumber && Number(c.id.replace(/\D/g, "")) === Number(camNumber[1])) || cameraTokens(c).some((token) => tokens.includes(token)));
  if (matched.length === 1) {
    filters.camera = matched[0].id;
    labels.push(matched[0].name);
  }
  const now = Date.now();
  const startOfToday = Math.floor(now / 86_400_000) * 86_400_000;
  if (/\b(hour|ghanta|ghante|ghanty)\b/.test(lower)) {
    filters.from = new Date(now - 3_600_000).toISOString();
    labels.push(urdu ? "pichla ek ghanta" : "last hour");
  } else if (/\b(today|aaj)\b/.test(lower)) {
    filters.from = new Date(startOfToday).toISOString();
    labels.push(urdu ? "aaj" : "today");
  } else if (/\b(yesterday|kal)\b/.test(lower)) {
    filters.from = new Date(startOfToday - 86_400_000).toISOString();
    filters.to = new Date(startOfToday).toISOString();
    labels.push(urdu ? "kal" : "yesterday");
  }
  if (/\b(no plate|without plate|bina plate)\b/.test(lower)) {
    filters.hasPlate = false;
    labels.push(urdu ? "bina plate" : "no plate read");
  }
  if (/low confidence|kam confidence/.test(lower)) {
    labels.push("low confidence");
  }
  return { filters, labels, urdu };
}

export function hasAnyFilter(filters: DetectionFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

function hrefFor(filters: DetectionFilters): string {
  const params = new URLSearchParams();
  if (filters.plate) params.set("q", filters.plate);
  if (filters.type) params.set("type", filters.type);
  if (filters.camera) params.set("camera", filters.camera);
  if (filters.colour) params.set("colour", filters.colour);
  if (filters.from) params.set("from", filters.from.slice(0, 10));
  if (filters.to) params.set("to", new Date(Date.parse(filters.to) - 86_400_000).toISOString().slice(0, 10));
  if (filters.hasPlate !== undefined) params.set("hasPlate", filters.hasPlate ? "yes" : "no");
  const search = params.toString();
  return search ? `/detections?${search}` : "/detections";
}

/** Runs the filters against the database and phrases the answer in English or Roman Urdu. */
export async function answerWithFilters(parsed: ParsedQuestion, limit = 5): Promise<AssistantReply> {
  const { filters, labels, urdu } = parsed;
  if (!hasAnyFilter(filters)) {
    return {
      text: urdu
        ? "Mujhe search ke liye kuch detail chahiye. Plate number, gaari ki type, colour, camera ya time batayein. Misal: “white car Clifton par aaj”."
        : "I need a detail to search with: a plate number, vehicle type, colour, camera, or time. For example: “white car near Clifton today”.",
      results: [],
      total: 0,
    };
  }
  const page = await getDetectionsPage({ ...filters, page: 1, pageSize: Math.min(10, limit), sort: "detectedAt", dir: "desc" });
  const summary = labels.join(", ") || "your filters";
  if (page.total === 0) {
    return {
      text: urdu
        ? `“${summary}” ke liye koi detection nahi mili. Plate ke hijje ya camera ka naam check karke dobara try karein.`
        : `No detections found for ${summary}. Check the plate spelling or try a different camera or time range.`,
      results: [],
      total: 0,
    };
  }
  return {
    text: urdu
      ? `${page.total} detection mili — ${summary}. Sab se naye ${page.rows.length} neeche hain.`
      : `Found ${page.total} detection${page.total === 1 ? "" : "s"} for ${summary}. Showing the ${page.rows.length} most recent.`,
    results: page.rows,
    total: page.total,
    href: hrefFor(filters),
  };
}

export async function answerQuestionWithRules(question: string): Promise<AssistantReply> {
  const cameras = await getCameras();
  return answerWithFilters(ruleBasedFilters(question, cameras));
}
