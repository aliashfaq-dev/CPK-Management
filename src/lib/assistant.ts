/**
 * Search assistant. This is a rule-based parser over the dummy data, NOT a real
 * AI model. To use Claude or Gemini, replace the body of `askAssistant` with a
 * call to your backend route and return the same `AssistantReply` shape.
 */
import type { Camera, Detection, VehicleType } from "@/types";

export interface AssistantReply {
  text: string;
  results: Detection[];
  total: number;
  href?: string;
}

const TYPE_WORDS: Record<VehicleType, string[]> = {
  Car: ["car", "cars", "gaari", "gari", "gaadi", "sedan", "suv"],
  Motorcycle: ["motorcycle", "motorcycles", "bike", "bikes", "motorbike"],
  Truck: ["truck", "trucks", "lorry"],
  Bus: ["bus", "buses"],
};

const COLOR_WORDS: Record<string, string[]> = {
  White: ["white", "safed", "safaid"],
  Black: ["black", "kala", "kali"],
  Silver: ["silver"],
  Grey: ["grey", "gray"],
  Blue: ["blue", "neela", "nila"],
  Red: ["red", "laal", "lal"],
  Green: ["green", "hara"],
};

const STOP_TOKENS = new Set(["block", "road", "junction", "gate", "bridge", "entrance", "approach", "terminal", "checkpoint", "plaza", "sector"]);
const URDU_HINT = /\b(kya|kahan|dikhao|dikha|mujhe|gaari|gari|gaadi|aaj|kal|safed|kala|neela|laal|hai|mein|ki|ka|ko|talash|dhoondo|dhundo|wali|wala)\b/i;
const PLATE = /\b([a-z]{2,3})[\s-]?(\d{3,4})\b/i;

function words(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

function cameraTokens(camera: Camera): string[] {
  return `${camera.name} ${camera.location}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 5 && !STOP_TOKENS.has(token));
}

export async function askAssistant(query: string, detections: Detection[], cameras: Camera[]): Promise<AssistantReply> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  const urdu = URDU_HINT.test(query);
  const tokens = words(query);
  const lower = query.toLowerCase();
  const filters: string[] = [];
  let rows = detections;

  const plateMatch = query.match(PLATE);
  if (plateMatch) {
    const plate = `${plateMatch[1]}${plateMatch[2]}`.toLowerCase();
    rows = rows.filter((d) => d.plate.replace("-", "").toLowerCase().includes(plate));
    filters.push(`plate ${plateMatch[1].toUpperCase()}-${plateMatch[2]}`);
  }

  const type = (Object.keys(TYPE_WORDS) as VehicleType[]).find((t) => TYPE_WORDS[t].some((w) => tokens.includes(w)));
  if (type) {
    rows = rows.filter((d) => d.vehicleType === type);
    filters.push(type.toLowerCase());
  }

  const color = Object.keys(COLOR_WORDS).find((c) => COLOR_WORDS[c].some((w) => tokens.includes(w)));
  if (color) {
    rows = rows.filter((d) => d.color === color);
    filters.push(color.toLowerCase());
  }

  const camNumber = lower.match(/\bcam[\s-]?0?(\d)\b/);
  const matchedCameras = cameras.filter(
    (c) => (camNumber && c.id === `CAM-0${camNumber[1]}`) || cameraTokens(c).some((token) => tokens.includes(token)),
  );
  if (matchedCameras.length > 0) {
    const ids = new Set(matchedCameras.map((c) => c.id));
    rows = rows.filter((d) => ids.has(d.cameraId));
    filters.push(matchedCameras.map((c) => c.name).join(" / "));
  }

  const latest = detections[0] ? Date.parse(detections[0].detectedAt) : Date.now();
  if (/\b(hour|ghanta|ghante|ghanty)\b/.test(lower)) {
    rows = rows.filter((d) => latest - Date.parse(d.detectedAt) <= 3_600_000);
    filters.push(urdu ? "pichla ek ghanta" : "last hour");
  } else if (/\b(today|aaj)\b/.test(lower)) {
    const day = detections[0]?.detectedAt.slice(0, 10);
    rows = rows.filter((d) => d.detectedAt.slice(0, 10) === day);
    filters.push(urdu ? "aaj" : "today");
  } else if (/\b(yesterday|kal)\b/.test(lower)) {
    const day = new Date(latest - 86_400_000).toISOString().slice(0, 10);
    rows = rows.filter((d) => d.detectedAt.slice(0, 10) === day);
    filters.push(urdu ? "kal" : "yesterday");
  }

  if (/low confidence|kam confidence/.test(lower)) {
    rows = rows.filter((d) => d.confidence < 90);
    filters.push("confidence below 90%");
  }

  if (filters.length === 0) {
    return {
      text: urdu
        ? "Mujhe search ke liye kuch detail chahiye. Plate number, gaari ki type, colour, camera ya time batayein. Misal: “white car Clifton par aaj”."
        : "I need a detail to search with: a plate number, vehicle type, color, camera, or time. For example: “white car near Clifton today”.",
      results: [],
      total: 0,
    };
  }

  const summary = filters.join(", ");
  if (rows.length === 0) {
    return {
      text: urdu
        ? `Sample data mein “${summary}” ke liye koi detection nahi mili. Plate ke hijje ya camera ka naam check karke dobara try karein.`
        : `No detections found for ${summary} in the sample data. Check the plate spelling or try a different camera.`,
      results: [],
      total: 0,
    };
  }

  const plates = Array.from(new Set(rows.map((d) => d.plate)));
  return {
    text: urdu
      ? `${rows.length} detection mili (${plates.length} gaari/gaariyan) — ${summary}. Sab se naye ${Math.min(5, rows.length)} neeche hain.`
      : `Found ${rows.length} detection${rows.length === 1 ? "" : "s"} across ${plates.length} vehicle${plates.length === 1 ? "" : "s"} for ${summary}. Showing the ${Math.min(5, rows.length)} most recent.`,
    results: rows.slice(0, 5),
    total: rows.length,
    href: plateMatch ? `/detections?q=${encodeURIComponent(`${plateMatch[1]}${plateMatch[2]}`)}` : "/detections",
  };
}
