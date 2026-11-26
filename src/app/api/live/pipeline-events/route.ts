import { NextResponse } from "next/server";
import WebSocket from "ws";
import { authorize } from "@/lib/auth-server";
import { isVehicleType } from "@/lib/constants";
import type { Detection } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;
const MAX_DEDUPE_IDS = 500;

function pipelineWsUrl(streamId: string | null): string | null {
  const port = process.env.SERVICE_PORT?.trim();
  const base =
    process.env.PIPELINE_URL?.trim() ||
    (port && /^\d+$/.test(port) ? `http://127.0.0.1:${port}` : "");
  if (!base) return null;
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return null;
  }
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/ws/events`;
  parsed.search = "";
  if (streamId) parsed.searchParams.set("stream_id", streamId);
  const token = process.env.PIPELINE_TOKEN?.trim() || process.env.SERVICE_TOKEN?.trim();
  if (token) parsed.searchParams.set("token", token);
  return parsed.toString();
}

function toDetection(raw: Record<string, unknown>): Detection | null {
  const id = raw.event_id ? String(raw.event_id) : "";
  const type = typeof raw.vehicle_type === "string" ? raw.vehicle_type.toLowerCase() : "";
  if (!id || !isVehicleType(type)) return null;
  const plate = typeof raw.number_plate === "string" ? raw.number_plate.trim() : "";
  const rawConf = Number(raw.number_plate_confidence ?? 0);
  const confidence = Number.isFinite(rawConf) ? (rawConf <= 1 ? rawConf * 100 : rawConf) : 0;
  const rawDetConf = raw.plate_detection_confidence === null || raw.plate_detection_confidence === undefined ? null : Number(raw.plate_detection_confidence);
  const plateDetectionConfidence = rawDetConf !== null && Number.isFinite(rawDetConf) ? (rawDetConf <= 1 ? rawDetConf * 100 : rawDetConf) : null;

  let detectedAt = new Date().toISOString();
  if (typeof raw.date === "string" && typeof raw.time === "string") {
    const candidate = new Date(`${raw.date}T${raw.time}Z`);
    if (!Number.isNaN(candidate.getTime())) detectedAt = candidate.toISOString();
  } else if (typeof raw.time === "string") {
    const candidate = new Date(raw.time);
    if (!Number.isNaN(candidate.getTime())) detectedAt = candidate.toISOString();
  }

  const cameraId = String(raw.camera_id ?? "");
  return {
    id,
    plate,
    hasPlate: plate.length > 0,
    vehicleType: type,
    make: null,
    color: null,
    analysisStatus: null,
    cameraId,
    cameraName: cameraId || "Unknown camera",
    location: "Live pipeline",
    detectedAt,
    confidence,
    plateDetectionConfidence,
    hasVehicleImage: Boolean(raw.snapshot_vehicle),
    hasPlateImage: Boolean(raw.snapshot_number_plate),
    type: "insert",
  };
}

/**
 * Optional fast-path SSE proxy over the pipeline's `/ws/events` WebSocket.
 * Disabled by default; set `LIVE_PIPELINE_EVENTS=1` to enable.
 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  if (process.env.LIVE_PIPELINE_EVENTS !== "1") {
    return NextResponse.json({ error: "Pipeline fast-path events are disabled." }, { status: 404 });
  }

  const streamParam = new URL(request.url).searchParams.get("stream_id")?.trim() ?? null;
  if (streamParam && !/^[a-z0-9-_]{1,40}$/i.test(streamParam)) {
    return NextResponse.json({ error: "Invalid stream_id." }, { status: 400 });
  }
  const targetUrl = pipelineWsUrl(streamParam);
  if (!targetUrl) {
    return NextResponse.json({ error: "Pipeline URL is not configured." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const seen = new Set<string>();

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const socket = new WebSocket(targetUrl, { handshakeTimeout: 8_000 });
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), HEARTBEAT_MS);

      const closeAll = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        socket.removeAllListeners();
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.terminate();
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      cleanup = closeAll;

      socket.on("open", () => {
        send(`event: hello\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString(), source: "pipeline" })}\n\n`);
      });

      socket.on("message", (buffer) => {
        try {
          const parsed = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
          const detection = toDetection(parsed);
          if (!detection || seen.has(detection.id)) return;
          seen.add(detection.id);
          if (seen.size > MAX_DEDUPE_IDS) {
            const oldest = seen.values().next().value;
            if (oldest) seen.delete(oldest);
          }
          send(`id: ${detection.id}\nevent: detection\ndata: ${JSON.stringify(detection)}\n\n`);
        } catch {
          /* ignore malformed upstream message */
        }
      });

      socket.on("error", closeAll);
      socket.on("close", closeAll);
      request.signal.addEventListener("abort", closeAll, { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
