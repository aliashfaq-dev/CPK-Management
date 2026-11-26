import { Client } from "pg";
import { evaluateAlertForDetection } from "@/lib/alerts";
import { getDetectionById } from "@/lib/data-service";
import { pgConfigFromUrl } from "@/lib/db";
import { warmEventThumbnails } from "@/lib/image-cache";
import type { Detection, LiveAlertPayload } from "@/types";

/**
 * Shared Postgres LISTEN/NOTIFY hub (singleton on globalThis).
 *
 * NOTE: On Neon, `LISTEN` does NOT work on a pooled (`-pooler`) connection string —
 * `DATABASE_URL_DIRECT` must be set to the direct (non-pooled) connection URL.
 * On local Docker Postgres, `DATABASE_URL` is already direct so the same URL works
 * for both the query pool and `LISTEN events_changed`.
 */

export type LiveBroadcast =
  | { kind: "detection"; eventId: string; payload: Detection }
  | { kind: "alert"; eventId: string; payload: LiveAlertPayload };

type Subscriber = (message: LiveBroadcast) => void;

interface LiveHubState {
  subscribers: Set<Subscriber>;
  client: Client | null;
  connecting: boolean;
  backoffMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  idleCloseTimer: ReturnType<typeof setTimeout> | null;
}

interface LiveGlobals {
  __cpkLiveHub?: LiveHubState;
}
const store = globalThis as typeof globalThis & LiveGlobals;

function getHub(): LiveHubState {
  if (!store.__cpkLiveHub) {
    store.__cpkLiveHub = {
      subscribers: new Set(),
      client: null,
      connecting: false,
      backoffMs: 1_000,
      reconnectTimer: null,
      idleCloseTimer: null,
    };
  }
  return store.__cpkLiveHub;
}

function directDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL_DIRECT?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

function emit(hub: LiveHubState, message: LiveBroadcast): void {
  for (const subscriber of hub.subscribers) {
    try {
      subscriber(message);
    } catch {
      /* isolate slow or closed subscribers */
    }
  }
}

async function handleNotification(hub: LiveHubState, rawPayload: string | undefined): Promise<void> {
  if (!rawPayload || hub.subscribers.size === 0) return;
  let parsed: { event_id?: unknown; op?: unknown };
  try {
    parsed = JSON.parse(rawPayload) as { event_id?: unknown; op?: unknown };
  } catch {
    return;
  }
  const eventId = typeof parsed.event_id === "string" || typeof parsed.event_id === "number" ? String(parsed.event_id) : "";
  if (!eventId) return;

  const op = typeof parsed.op === "string" && parsed.op.toLowerCase() === "update" ? "update" : "insert";
  try {
    const detection = await getDetectionById(eventId);
    if (!detection) return;
    const withOp: Detection = { ...detection, type: op };
    emit(hub, { kind: "detection", eventId: detection.id, payload: withOp });

    if (op === "insert") {
      warmEventThumbnails(detection.id);
      const alert = await evaluateAlertForDetection(detection);
      if (alert) {
        emit(hub, { kind: "alert", eventId: detection.id, payload: alert });
      }
    }
  } catch {
    /* transient query failures should not tear down the listener */
  }
}

function scheduleReconnect(hub: LiveHubState): void {
  if (hub.reconnectTimer || hub.subscribers.size === 0) return;
  const jitter = Math.floor(Math.random() * 400);
  const delay = hub.backoffMs + jitter;
  hub.backoffMs = Math.min(30_000, hub.backoffMs * 2);
  hub.reconnectTimer = setTimeout(() => {
    hub.reconnectTimer = null;
    void ensureListening(hub);
  }, delay);
}

async function detachClient(hub: LiveHubState, target: Client): Promise<void> {
  if (hub.client === target) {
    hub.client = null;
  }
  target.removeAllListeners();
  await target.end().catch(() => undefined);
}

async function ensureListening(hub: LiveHubState): Promise<void> {
  if (hub.client || hub.connecting || hub.subscribers.size === 0) return;
  const rawUrl = directDatabaseUrl();
  if (!rawUrl) return;

  hub.connecting = true;
  const client = new Client({
    ...pgConfigFromUrl(rawUrl),
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
  });

  const onDisconnect = () => {
    void detachClient(hub, client).finally(() => scheduleReconnect(hub));
  };

  client.on("error", onDisconnect);
  client.on("end", onDisconnect);
  client.on("notification", (msg) => {
    if (msg.channel === "events_changed") {
      void handleNotification(hub, msg.payload);
    }
  });

  try {
    await client.connect();
    await client.query("LISTEN events_changed");
    hub.client = client;
    hub.backoffMs = 1_000;
  } catch {
    await detachClient(hub, client);
    scheduleReconnect(hub);
  } finally {
    hub.connecting = false;
  }
}

/** Subscribes an SSE response stream to Postgres `events_changed` notifications. */
export function subscribeLiveEvents(subscriber: Subscriber): () => void {
  const hub = getHub();
  if (hub.idleCloseTimer) {
    clearTimeout(hub.idleCloseTimer);
    hub.idleCloseTimer = null;
  }
  hub.subscribers.add(subscriber);
  void ensureListening(hub);

  return () => {
    hub.subscribers.delete(subscriber);
    if (hub.subscribers.size === 0) {
      if (hub.reconnectTimer) {
        clearTimeout(hub.reconnectTimer);
        hub.reconnectTimer = null;
      }
      hub.idleCloseTimer = setTimeout(() => {
        hub.idleCloseTimer = null;
        if (hub.subscribers.size === 0 && hub.client) {
          void detachClient(hub, hub.client);
        }
      }, 60_000);
    }
  };
}
