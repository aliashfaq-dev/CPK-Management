import { z } from "zod";
import type { PipelineStream, PipelineStreamStatus, PlateFormat, StreamState } from "@/types";

/**
 * Server-only client for the local Python FastAPI detection pipeline.
 * Never logs or leaks PIPELINE_URL, PIPELINE_TOKEN, or RTSP credentials.
 */

const DEFAULT_PIPELINE_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 8_000;

export const STREAM_ID_REGEX = /^[a-z0-9-_]{1,40}$/;

export const streamIdSchema = z
  .string()
  .trim()
  .regex(STREAM_ID_REGEX, "Stream ID must be 1–40 characters of a-z, 0-9, - or _.");

export const plateFormatSchema = z.enum(["GENERAL", "UK", "PAKISTAN"]);

export const safeVideoFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (file) => !file.includes("..") && !file.includes("/") && !file.includes("\\") && /\.(mp4|mkv|avi)$/i.test(file),
    "Video file must be a relative .mp4, .mkv, or .avi filename.",
  );

export const rtspUrlSchema = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .refine((url) => /^rtsp:\/\//i.test(url), "RTSP URL must start with rtsp://.");

export const createStreamSchema = z.object({
  id: streamIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  camera_id: z.string().trim().min(1).max(60),
  location: z.string().trim().min(1).max(160),
  loop: z.boolean(),
  plate_format: plateFormatSchema,
  vehicle_weights: z.string().trim().max(120).optional(),
  publish_rtsp: z.boolean().optional(),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("file"), file: safeVideoFileSchema }),
    z.object({ type: z.literal("rtsp"), url: rtspUrlSchema }),
  ]),
});

export const patchStreamSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    loop: z.boolean().optional(),
    plate_format: plateFormatSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export class PipelineError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** True when PIPELINE_URL or SERVICE_PORT is set in the server environment. */
export function isPipelineConfigured(): boolean {
  return Boolean(process.env.PIPELINE_URL?.trim() || process.env.SERVICE_PORT?.trim());
}

function pipelineAuthToken(): string | undefined {
  return process.env.PIPELINE_TOKEN?.trim() || process.env.SERVICE_TOKEN?.trim() || undefined;
}

function resolvePipelineBaseUrl(): string {
  const port = process.env.SERVICE_PORT?.trim();
  const fallback = port && /^\d+$/.test(port) ? `http://127.0.0.1:${port}` : DEFAULT_PIPELINE_URL;
  const raw = process.env.PIPELINE_URL?.trim() || fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PipelineError("Pipeline service URL is invalid.", 500);
  }
  return parsed.toString().replace(/\/$/, "");
}

/** Masks embedded credentials in `rtsp://user:pass@host/...` strings before returning to clients. */
export function maskRtspUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^(rtsps?:\/\/)([^/@\s]+)@/i, "$1***:***@");
}

function normalizeState(value: unknown): StreamState {
  if (value === "running" || value === "stopped" || value === "error") return value;
  return "stopped";
}

function normalizePlateFormat(value: unknown): PlateFormat {
  if (value === "GENERAL" || value === "UK" || value === "PAKISTAN") return value;
  return "PAKISTAN";
}

export function sanitizeStatus(raw: unknown): PipelineStreamStatus {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    state: normalizeState(obj.state),
    fps: Math.round(num(obj.fps) * 10) / 10,
    frames: Math.floor(num(obj.frames)),
    events: Math.floor(num(obj.events)),
    last_event: typeof obj.last_event === "string" ? obj.last_event : null,
    uptime_s: Math.floor(num(obj.uptime_s)),
    restarts: Math.floor(num(obj.restarts)),
    last_error: typeof obj.last_error === "string" && obj.last_error ? maskRtspUrl(obj.last_error) ?? null : null,
    ...(typeof obj.rtsp_url === "string" && obj.rtsp_url ? { rtsp_url: maskRtspUrl(obj.rtsp_url) ?? null } : {}),
  };
}

export function sanitizeStream(raw: unknown): PipelineStream | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : typeof obj.stream_id === "string" ? obj.stream_id : "";
  if (!id) return null;

  const rawSource = (obj.source && typeof obj.source === "object" ? obj.source : {}) as Record<string, unknown>;
  const sourceType = rawSource.type === "rtsp" ? "rtsp" : "file";

  return {
    id,
    name: typeof obj.name === "string" && obj.name ? obj.name : id,
    camera_id: typeof obj.camera_id === "string" ? obj.camera_id : id,
    loop: Boolean(obj.loop),
    plate_format: normalizePlateFormat(obj.plate_format),
    publish_rtsp: typeof obj.publish_rtsp === "boolean" ? obj.publish_rtsp : undefined,
    source:
      sourceType === "rtsp"
        ? { type: "rtsp", url: maskRtspUrl(typeof rawSource.url === "string" ? rawSource.url : "") }
        : { type: "file", file: typeof rawSource.file === "string" ? rawSource.file : "" },
    ...(obj.status && typeof obj.status === "object"
      ? { status: sanitizeStatus(obj.status) }
      : typeof obj.state === "string"
        ? { status: sanitizeStatus(obj) }
        : {}),
  };
}

export async function pipelineFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const base = resolvePipelineBaseUrl();
  const headers = new Headers(init.headers);
  const token = pipelineAuthToken();
  if (token) {
    headers.set("X-API-KEY", token);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new PipelineError("Detection pipeline timed out after 8 seconds.", 504);
    }
    throw new PipelineError("Detection pipeline is unreachable.", 503);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: unknown; error?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (typeof body.error === "string") detail = body.error;
    } catch {
      /* ignore non-JSON body */
    }
    const safeMessage = detail ? maskRtspUrl(detail) ?? detail : `Pipeline returned HTTP ${response.status}.`;
    throw new PipelineError(safeMessage, response.status >= 400 && response.status < 500 ? response.status : 502);
  }

  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
}

export async function listPipelineVideos(): Promise<string[]> {
  const raw = await pipelineFetch<unknown>("/videos");
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { videos?: unknown }).videos)
      ? (raw as { videos: unknown[] }).videos
      : raw && typeof raw === "object" && Array.isArray((raw as { files?: unknown }).files)
        ? (raw as { files: unknown[] }).files
        : [];

  return list
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
        return (entry as { name: string }).name;
      }
      if (entry && typeof entry === "object" && typeof (entry as { file?: unknown }).file === "string") {
        return (entry as { file: string }).file;
      }
      return "";
    })
    .filter((name) => safeVideoFileSchema.safeParse(name).success);
}

export async function listStreamsWithStatus(): Promise<PipelineStream[]> {
  const raw = await pipelineFetch<unknown>("/streams");
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { streams?: unknown }).streams)
      ? (raw as { streams: unknown[] }).streams
      : [];

  const streams = entries.map(sanitizeStream).filter((item): item is PipelineStream => item !== null);
  return Promise.all(
    streams.map(async (stream) => {
      if (stream.status) return stream;
      try {
        const statusRaw = await pipelineFetch<unknown>(`/streams/${encodeURIComponent(stream.id)}/status`);
        return { ...stream, status: sanitizeStatus(statusRaw) };
      } catch {
        return stream;
      }
    }),
  );
}

/** Server-only WebSocket URL for `/ws/frames/{streamId}?token=...`. Never expose to clients. */
export function buildFramesWsUrl(streamId: string): string {
  if (!STREAM_ID_REGEX.test(streamId)) {
    throw new PipelineError("Invalid stream ID.", 400);
  }
  const parsed = new URL(resolvePipelineBaseUrl());
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/ws/frames/${encodeURIComponent(streamId)}`;
  parsed.search = "";
  const token = pipelineAuthToken();
  if (token) {
    parsed.searchParams.set("token", token);
  }
  return parsed.toString();
}
