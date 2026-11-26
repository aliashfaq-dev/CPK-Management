"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { AppNotification, Detection, LiveAlertPayload } from "@/types";

export type LiveConnectionStatus = "live" | "reconnecting";

export interface LiveDetectionEvent {
  detection: Detection;
  isUpdate: boolean;
}

type DetectionListener = (event: LiveDetectionEvent) => void;

interface LiveStoreState {
  status: LiveConnectionStatus;
  events: Detection[];
  notifications: AppNotification[];
  unreadCount: number;
  activeToast: AppNotification | null;
}

const MAX_BUFFER = 200;
const CATCHUP_AFTER_MS = 30_000;
const TOAST_MS = 6_000;

let state: LiveStoreState = {
  status: "reconnecting",
  events: [],
  notifications: [],
  unreadCount: 0,
  activeToast: null,
};

let seededInitialNotifications = false;
let subscriberCount = 0;
let eventSource: EventSource | null = null;
let downSince: number | null = null;
let caughtUpForOutage = false;
let lastSeenIso: string | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const seenIds = new Set<string>();
const storeListeners = new Set<() => void>();
const detectionListeners = new Set<DetectionListener>();

function notifyStore(): void {
  for (const listener of storeListeners) {
    listener();
  }
}

function alertToNotification(alert: LiveAlertPayload): AppNotification {
  const plate = alert.event.hasPlate && alert.event.plate ? alert.event.plate : "No plate";
  return {
    id: alert.id,
    title: `${alert.severity === "high" ? "Watchlist alert" : "Detection alert"} · ${plate}`,
    description: `${alert.reason} · ${alert.event.cameraName}`,
    time: alert.createdAt,
    tone: alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info",
  };
}

function ingestDetection(incoming: Detection): void {
  const isUpdate = incoming.type === "update" || seenIds.has(incoming.id);
  seenIds.add(incoming.id);
  if (seenIds.size > 1_000) {
    const oldest = seenIds.values().next().value;
    if (oldest) seenIds.delete(oldest);
  }
  if (incoming.detectedAt && (!lastSeenIso || incoming.detectedAt > lastSeenIso)) {
    lastSeenIso = incoming.detectedAt;
  }

  const nextEvents = state.events.some((item) => item.id === incoming.id)
    ? state.events.map((item) => (item.id === incoming.id ? incoming : item))
    : [incoming, ...state.events].slice(0, MAX_BUFFER);

  state = { ...state, events: nextEvents };
  notifyStore();

  for (const listener of detectionListeners) {
    listener({ detection: incoming, isUpdate });
  }
}

function ingestAlert(alert: LiveAlertPayload): void {
  const item = alertToNotification(alert);
  if (state.notifications.some((existing) => existing.id === item.id)) return;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastTimer = null;
    state = { ...state, activeToast: null };
    notifyStore();
  }, TOAST_MS);

  state = {
    ...state,
    notifications: [item, ...state.notifications].slice(0, 50),
    unreadCount: state.unreadCount + 1,
    activeToast: item,
  };
  notifyStore();
}

async function runFallbackCatchUp(): Promise<void> {
  const since = lastSeenIso ?? new Date(Date.now() - 5 * 60_000).toISOString();
  try {
    const response = await fetch(`/api/detections?since=${encodeURIComponent(since)}`, { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { rows?: Detection[] };
    const rows = [...(body.rows ?? [])].reverse();
    for (const row of rows) {
      if (!seenIds.has(row.id)) {
        ingestDetection({ ...row, type: "insert" });
      }
    }
  } catch {
    /* next SSE reconnect will still send Last-Event-ID */
  }
}

function startConnection(): void {
  if (eventSource || typeof window === "undefined") return;
  if (!lastSeenIso) {
    lastSeenIso = new Date().toISOString();
  }
  downSince = Date.now();
  caughtUpForOutage = false;

  const source = new EventSource("/api/live/events");
  eventSource = source;

  const markLive = () => {
    downSince = null;
    caughtUpForOutage = false;
    if (state.status !== "live") {
      state = { ...state, status: "live" };
      notifyStore();
    }
  };

  source.addEventListener("open", markLive);
  source.addEventListener("hello", markLive);

  source.addEventListener("detection", (event) => {
    markLive();
    try {
      const parsed = JSON.parse((event as MessageEvent<string>).data) as Detection;
      if (parsed && parsed.id) ingestDetection(parsed);
    } catch {
      /* ignore malformed payload */
    }
  });

  source.addEventListener("alert", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent<string>).data) as LiveAlertPayload;
      if (parsed && parsed.id) ingestAlert(parsed);
    } catch {
      /* ignore malformed payload */
    }
  });

  source.addEventListener("error", () => {
    if (downSince === null) {
      downSince = Date.now();
      caughtUpForOutage = false;
    }
    if (state.status !== "reconnecting") {
      state = { ...state, status: "reconnecting" };
      notifyStore();
    }
  });

  if (!watchdogTimer) {
    watchdogTimer = setInterval(() => {
      if (downSince !== null && !caughtUpForOutage && Date.now() - downSince >= CATCHUP_AFTER_MS) {
        caughtUpForOutage = true;
        void runFallbackCatchUp();
      }
    }, 5_000);
  }
}

function stopConnection(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  downSince = null;
}

function subscribe(onStoreChange: () => void): () => void {
  storeListeners.add(onStoreChange);
  subscriberCount += 1;
  if (subscriberCount === 1) {
    startConnection();
  }
  return () => {
    storeListeners.delete(onStoreChange);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      stopConnection();
    }
  };
}

function getSnapshot(): LiveStoreState {
  return state;
}

const SERVER_SNAPSHOT: LiveStoreState = {
  status: "reconnecting",
  events: [],
  notifications: [],
  unreadCount: 0,
  activeToast: null,
};

function getServerSnapshot(): LiveStoreState {
  return SERVER_SNAPSHOT;
}

export function seedInitialNotifications(items: AppNotification[]): void {
  if (seededInitialNotifications) return;
  seededInitialNotifications = true;
  if (items.length > 0 && state.notifications.length === 0) {
    state = { ...state, notifications: items };
    notifyStore();
  }
}

export function useLiveEvents(initialNotifications?: AppNotification[]) {
  useEffect(() => {
    if (initialNotifications) {
      seedInitialNotifications(initialNotifications);
    }
  }, [initialNotifications]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markAlertsRead = useCallback(() => {
    if (state.unreadCount === 0) return;
    state = { ...state, unreadCount: 0 };
    notifyStore();
  }, []);

  const dismissToast = useCallback(() => {
    if (!state.activeToast) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    state = { ...state, activeToast: null };
    notifyStore();
  }, []);

  return {
    ...snapshot,
    markAlertsRead,
    dismissToast,
  };
}

/** Subscribes a component callback to incoming live detection inserts and stage-2 updates. */
export function useLiveDetectionSubscription(onEvent: DetectionListener): void {
  const callbackRef = useRef(onEvent);
  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const handler: DetectionListener = (event) => callbackRef.current(event);
    detectionListeners.add(handler);
    subscriberCount += 1;
    if (subscriberCount === 1) {
      startConnection();
    }
    return () => {
      detectionListeners.delete(handler);
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0) {
        stopConnection();
      }
    };
  }, []);
}
