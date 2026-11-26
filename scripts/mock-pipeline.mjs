#!/usr/bin/env node
// Local mock of the FastAPI detection pipeline so the frontend can be exercised without Python/GPU.
// Implements the exact REST + WebSocket contract (`/health`, `/videos`, `/cameras`, `/streams`,
// `/ws/frames/{stream_id}`, `/ws/events`). Usage: npm run mock:pipeline
import { createServer } from "node:http";
import { readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.MOCK_PIPELINE_PORT || 8000);
const expectedToken = process.env.PIPELINE_TOKEN?.trim() || "";
const startedAt = Date.now();

// Minimal valid 1x1 baseline grayscale JPEG (two brightness variants so live frame updates are visible).
const JPEG_DARK = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);
const JPEG_MID = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const VEHICLE_TYPES = ["car", "rickshaw", "htv", "van", "pickup", "bike"];
const SAMPLE_PLATES = ["BKL-2847", "ARZ-9013", "KTN-5526", "KDL-3092", "TKA-9132", "AXM-7342"];

/** @type {Map<string, any>} */
const streams = new Map([
  [
    "cam-01",
    {
      id: "cam-01",
      name: "Karsaz Junction",
      camera_id: "CAM-01",
      loop: true,
      plate_format: "PAKISTAN",
      source: { type: "file", file: "sample.mp4" },
      state: "running",
      startedAt: Date.now(),
      frames: 0,
      events: 0,
      last_event: null,
      restarts: 0,
      last_error: null,
    },
  ],
]);

/** @type {Array<Record<string, unknown>>} */
const recentEvents = [];
let eventCounter = 1000;

function checkRestAuth(req) {
  if (!expectedToken) return true;
  return req.headers["x-api-key"] === expectedToken;
}

function checkWsAuth(urlObj) {
  if (!expectedToken) return true;
  return urlObj.searchParams.get("token") === expectedToken;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function statusOf(s) {
  const running = s.state === "running";
  return {
    state: s.state,
    fps: running ? 10.0 : 0,
    frames: s.frames,
    events: s.events,
    last_event: s.last_event,
    uptime_s: running && s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0,
    restarts: s.restarts,
    last_error: s.last_error,
  };
}

function serializeStream(s) {
  return {
    id: s.id,
    name: s.name,
    camera_id: s.camera_id,
    loop: s.loop,
    plate_format: s.plate_format,
    source: s.source,
    status: statusOf(s),
  };
}

function listVideoFiles() {
  const videoDir = join(root, "public", "videos");
  const files = existsSync(videoDir)
    ? readdirSync(videoDir).filter((f) => /\.(mp4|mkv|avi)$/i.test(f))
    : [];
  return files.length > 0 ? files : ["sample.mp4"];
}

const server = createServer(async (req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const path = urlObj.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (!checkRestAuth(req)) {
    return sendJson(res, 401, { detail: "Invalid X-API-KEY." });
  }

  if (method === "GET" && path === "/health") {
    return sendJson(res, 200, { ok: true, uptime_s: Math.floor((Date.now() - startedAt) / 1000) });
  }

  if (method === "GET" && path === "/videos") {
    return sendJson(res, 200, { videos: listVideoFiles() });
  }

  if (method === "GET" && path === "/cameras") {
    return sendJson(
      res,
      200,
      Array.from(streams.values()).map((s) => ({ camera_id: s.camera_id, name: s.name })),
    );
  }

  if (method === "GET" && path === "/streams") {
    return sendJson(res, 200, Array.from(streams.values()).map(serializeStream));
  }

  if (method === "POST" && path === "/streams") {
    try {
      const body = await readBody(req);
      const id = String(body.id || body.camera_id || `stream-${streams.size + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .slice(0, 40);
      const entry = {
        id,
        name: String(body.name || id),
        camera_id: String(body.camera_id || id.toUpperCase()),
        loop: Boolean(body.loop),
        plate_format: body.plate_format || "PAKISTAN",
        source: body.source || { type: "file", file: "sample.mp4" },
        state: "running",
        startedAt: Date.now(),
        frames: 0,
        events: 0,
        last_event: null,
        restarts: 0,
        last_error: null,
      };
      streams.set(id, entry);
      return sendJson(res, 201, serializeStream(entry));
    } catch {
      return sendJson(res, 400, { detail: "Invalid JSON body." });
    }
  }

  const match = path.match(/^\/streams\/([a-z0-9-_]{1,40})(?:\/(status|start|stop|restart))?$/i);
  if (match) {
    const [, id, sub] = match;
    const stream = streams.get(id);
    if (!stream) return sendJson(res, 404, { detail: "Stream not found." });

    if (!sub && method === "PATCH") {
      const body = await readBody(req).catch(() => ({}));
      if (typeof body.name === "string") stream.name = body.name;
      if (typeof body.loop === "boolean") stream.loop = body.loop;
      if (typeof body.plate_format === "string") stream.plate_format = body.plate_format;
      return sendJson(res, 200, serializeStream(stream));
    }
    if (!sub && method === "DELETE") {
      streams.delete(id);
      return sendJson(res, 200, { ok: true });
    }
    if (sub === "status" && method === "GET") {
      return sendJson(res, 200, statusOf(stream));
    }
    if (sub === "start" && method === "POST") {
      stream.state = "running";
      stream.startedAt = Date.now();
      return sendJson(res, 200, statusOf(stream));
    }
    if (sub === "stop" && method === "POST") {
      stream.state = "stopped";
      stream.startedAt = null;
      return sendJson(res, 200, statusOf(stream));
    }
    if (sub === "restart" && method === "POST") {
      stream.state = "running";
      stream.startedAt = Date.now();
      stream.restarts += 1;
      return sendJson(res, 200, statusOf(stream));
    }
  }

  return sendJson(res, 404, { detail: "Not found." });
});

const wss = new WebSocketServer({ noServer: true });
/** @type {Set<{ ws: import('ws').WebSocket; filterStreamId: string | null }>} */
const eventClients = new Set();
/** @type {Map<string, Set<import('ws').WebSocket>>} */
const frameClients = new Map();

server.on("upgrade", (req, socket, head) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  if (!checkWsAuth(urlObj)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const frameMatch = urlObj.pathname.match(/^\/ws\/frames\/([a-z0-9-_]{1,40})$/i);
  if (frameMatch) {
    const streamId = frameMatch[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      let set = frameClients.get(streamId);
      if (!set) {
        set = new Set();
        frameClients.set(streamId, set);
      }
      set.add(ws);
      ws.on("close", () => set.delete(ws));
    });
    return;
  }

  if (urlObj.pathname === "/ws/events") {
    const filterStreamId = urlObj.searchParams.get("stream_id");
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = { ws, filterStreamId };
      eventClients.add(client);
      const initial = recentEvents
        .filter((ev) => !filterStreamId || ev.stream_id === filterStreamId)
        .slice(-10);
      for (const ev of initial) {
        ws.send(JSON.stringify(ev));
      }
      ws.on("close", () => eventClients.delete(client));
    });
    return;
  }

  socket.destroy();
});

// ~10 fps binary JPEG emitter for running streams.
let tick = 0;
setInterval(() => {
  tick += 1;
  const jpeg = tick % 10 < 5 ? JPEG_DARK : JPEG_MID;
  for (const [id, stream] of streams) {
    if (stream.state !== "running") continue;
    stream.frames += 1;
    const clients = frameClients.get(id);
    if (!clients) continue;
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(jpeg, { binary: true });
      }
    }
  }
}, 100);

// Emit a synthetic detection every 5s across running streams.
setInterval(() => {
  for (const [id, stream] of streams) {
    if (stream.state !== "running") continue;
    eventCounter += 1;
    const now = new Date();
    const plate = SAMPLE_PLATES[eventCounter % SAMPLE_PLATES.length];
    const event = {
      event_id: `MOCK-EVT-${eventCounter}`,
      stream_id: id,
      camera_id: stream.camera_id,
      date: now.toISOString().slice(0, 10),
      time: now.toISOString().slice(11, 19),
      snapshot_number_plate: null,
      snapshot_vehicle: null,
      plate_detection_confidence: 0.96,
      number_plate: plate,
      number_plate_confidence: 0.94,
      vehicle_type: VEHICLE_TYPES[eventCounter % VEHICLE_TYPES.length],
    };
    stream.events += 1;
    stream.last_event = now.toISOString();
    recentEvents.push(event);
    if (recentEvents.length > 50) recentEvents.shift();

    for (const client of eventClients) {
      if (client.ws.readyState === client.ws.OPEN && (!client.filterStreamId || client.filterStreamId === id)) {
        client.ws.send(JSON.stringify(event));
      }
    }
  }
}, 5_000);

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock detection pipeline listening on http://127.0.0.1:${port}`);
});
