import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { query } from "@/lib/db";
import { fetchS3ObjectBuffer, isS3Configured, S3ObjectNotFoundError } from "@/lib/s3";

/**
 * Server-side resized WebP disk cache for immutable event snapshots (`vehicle` and `plate`).
 *
 * Design:
 * - Disk files live at `${CACHE_DIR}/${safeEventId}_${kind}_${w}.webp` (default `.cache/images`).
 * - Allowed widths: `160`, `320`, `640`, `0` (original dimensions encoded as WebP).
 * - A 5,000-entry in-memory LRU caches `eventId -> { s3Bucket, vehicleKey, plateKey }` so DB lookups
 *   are skipped on cache misses whenever the event was recently listed.
 * - Concurrent requests share both the in-flight S3 `GetObject` and in-flight `sharp` encode.
 * - Whenever an original S3 buffer is downloaded, sibling sizes (`160`, `320`, `640` for `vehicle`;
 *   `160`, `320` for `plate`) are also materialized asynchronously from the same RAM buffer so opening
 *   the detail drawer never triggers a second slow WAN download.
 * - Disk size is bounded by `IMAGE_CACHE_MAX_MB` (default `2048` MB), evicting LRU by `atimeMs`.
 */

export type ImageKind = "vehicle" | "plate";
export type ImageWidth = 0 | 160 | 320 | 640;

export const ALLOWED_IMAGE_WIDTHS = new Set<number>([0, 160, 320, 640]);

const KEY_LRU_MAX = 5_000;
const WEBP_QUALITY = 75;
const WEBP_ORIGINAL_QUALITY = 82;
const PRUNE_EVERY_WRITES = 40;

export interface EventImageKeys {
  s3Bucket: string | null;
  vehicleKey: string | null;
  plateKey: string | null;
}

export interface ImageTimings {
  diskMs: number;
  dbMs: number;
  s3Ms: number;
  resizeMs: number;
  source: "disk" | "304" | "miss" | "inflight";
}

export type ResolvedImageResult =
  | { status: "ok"; buffer: Buffer; etag: string; timings: ImageTimings }
  | { status: "not-modified"; etag: string; timings: ImageTimings }
  | { status: "not-found"; timings: ImageTimings };

interface ImageCacheState {
  keyLru: Map<string, EventImageKeys | null>;
  s3Inflight: Map<string, Promise<{ buf: Buffer; s3Ms: number }>>;
  renderInflight: Map<string, Promise<Buffer>>;
  dirReady: Promise<string> | null;
  dirSignature: string;
  writesSincePrune: number;
  pruning: boolean;
  tmpSeq: number;
}

interface ImageGlobals {
  __cpkImageCache?: ImageCacheState;
}
const store = globalThis as typeof globalThis & ImageGlobals;

function getState(): ImageCacheState {
  if (!store.__cpkImageCache) {
    store.__cpkImageCache = {
      keyLru: new Map(),
      s3Inflight: new Map(),
      renderInflight: new Map(),
      dirReady: null,
      dirSignature: "",
      writesSincePrune: 0,
      pruning: false,
      tmpSeq: 0,
    };
  }
  return store.__cpkImageCache;
}

export function resolveCacheDir(): string {
  const configured = process.env.CACHE_DIR?.trim() || ".cache/images";
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function maxCacheBytes(): number {
  const raw = Number(process.env.IMAGE_CACHE_MAX_MB);
  const mb = Number.isFinite(raw) && raw > 0 ? raw : 2048;
  return Math.floor(mb * 1024 * 1024);
}

async function ensureCacheDir(): Promise<string> {
  const state = getState();
  const dir = resolveCacheDir();
  if (!state.dirReady || state.dirSignature !== dir) {
    state.dirSignature = dir;
    state.dirReady = mkdir(dir, { recursive: true }).then(() => dir);
  }
  return state.dirReady;
}

function safeToken(eventId: string): string {
  if (/^[A-Za-z0-9_-]{1,96}$/.test(eventId)) {
    return eventId;
  }
  return createHash("sha256").update(eventId).digest("hex").slice(0, 32);
}

export function buildEtag(eventId: string, kind: ImageKind, width: ImageWidth): string {
  return `"img-${safeToken(eventId)}-${kind}-${width}"`;
}

async function cacheFilePath(eventId: string, kind: ImageKind, width: ImageWidth): Promise<string> {
  const dir = await ensureCacheDir();
  return join(dir, `${safeToken(eventId)}_${kind}_${width}.webp`);
}

/** Seeds the 5,000-entry in-memory LRU when listing detections/vehicles so `/api/images` skips DB lookups. */
export function primeEventImageKeys(
  eventId: string,
  s3Bucket: string | null | undefined,
  vehicleKey: string | null | undefined,
  plateKey: string | null | undefined,
): void {
  if (!eventId) return;
  const lru = getState().keyLru;
  lru.delete(eventId);
  lru.set(eventId, {
    s3Bucket: s3Bucket?.trim() || null,
    vehicleKey: vehicleKey?.trim() || null,
    plateKey: plateKey?.trim() || null,
  });
  if (lru.size > KEY_LRU_MAX) {
    const oldest = lru.keys().next().value;
    if (oldest !== undefined) lru.delete(oldest);
  }
}

async function lookupEventKeys(eventId: string): Promise<{ keys: EventImageKeys | null; dbMs: number }> {
  const lru = getState().keyLru;
  if (lru.has(eventId)) {
    const cached = lru.get(eventId) ?? null;
    // Refresh recency
    lru.delete(eventId);
    lru.set(eventId, cached);
    return { keys: cached, dbMs: 0 };
  }

  const t0 = performance.now();
  const result = await query<{
    s3_bucket: string | null;
    vehicle_key: string | null;
    plate_key: string | null;
  }>(
    "SELECT s3_bucket, vehicle_key, plate_key FROM public.v_events_dashboard WHERE event_id = $1 LIMIT 1",
    [eventId],
  );
  const dbMs = performance.now() - t0;
  const row = result.rows[0];
  if (!row) {
    lru.set(eventId, null);
    if (lru.size > KEY_LRU_MAX) {
      const oldest = lru.keys().next().value;
      if (oldest !== undefined) lru.delete(oldest);
    }
    return { keys: null, dbMs };
  }

  const entry: EventImageKeys = {
    s3Bucket: row.s3_bucket?.trim() || null,
    vehicleKey: row.vehicle_key?.trim() || null,
    plateKey: row.plate_key?.trim() || null,
  };
  primeEventImageKeys(eventId, entry.s3Bucket, entry.vehicleKey, entry.plateKey);
  return { keys: entry, dbMs };
}

async function encodeWebp(source: Buffer, width: ImageWidth): Promise<Buffer> {
  const pipeline = sharp(source, { failOn: "none" }).rotate();
  if (width > 0) {
    pipeline.resize({ width, withoutEnlargement: true });
    return pipeline.webp({ quality: WEBP_QUALITY, effort: 3 }).toBuffer();
  }
  return pipeline.webp({ quality: WEBP_ORIGINAL_QUALITY, effort: 3 }).toBuffer();
}

async function writeAtomic(targetPath: string, data: Buffer): Promise<void> {
  const state = getState();
  state.tmpSeq = (state.tmpSeq + 1) % 1_000_000;
  const tmpPath = `${targetPath}.tmp-${process.pid}-${state.tmpSeq}`;
  await writeFile(tmpPath, data);
  try {
    await rename(tmpPath, targetPath);
  } catch {
    await unlink(tmpPath).catch(() => undefined);
  }
  state.writesSincePrune += 1;
  if (state.writesSincePrune >= PRUNE_EVERY_WRITES) {
    state.writesSincePrune = 0;
    void pruneDiskCacheIfNeeded();
  }
}

/** Enforces `IMAGE_CACHE_MAX_MB` by evicting least-recently-accessed `.webp` files. */
export async function pruneDiskCacheIfNeeded(): Promise<void> {
  const state = getState();
  if (state.pruning) return;
  state.pruning = true;
  try {
    const dir = await ensureCacheDir();
    const limit = maxCacheBytes();
    const names = await readdir(dir);
    const files: Array<{ path: string; size: number; atimeMs: number }> = [];
    let totalBytes = 0;

    for (const name of names) {
      if (!name.endsWith(".webp")) continue;
      const full = join(dir, name);
      try {
        const info = await stat(full);
        if (!info.isFile()) continue;
        totalBytes += info.size;
        files.push({ path: full, size: info.size, atimeMs: info.atimeMs || info.mtimeMs });
      } catch {
        /* ignore concurrently removed files */
      }
    }

    if (totalBytes <= limit) return;
    // Evict down to 90% of cap so we don't prune on every subsequent write.
    const targetBytes = Math.floor(limit * 0.9);
    files.sort((a, b) => a.atimeMs - b.atimeMs);
    for (const file of files) {
      if (totalBytes <= targetBytes) break;
      await unlink(file.path).catch(() => undefined);
      totalBytes -= file.size;
    }
  } catch {
    /* ignore cache directory inspection errors */
  } finally {
    state.pruning = false;
  }
}

async function fetchOriginalDeduplicated(
  eventId: string,
  kind: ImageKind,
  s3Bucket: string | null,
  objectKey: string,
): Promise<{ buf: Buffer; s3Ms: number; shared: boolean }> {
  const state = getState();
  const inflightKey = `${eventId}:${kind}`;
  const existing = state.s3Inflight.get(inflightKey);
  if (existing) {
    const res = await existing;
    return { ...res, shared: true };
  }

  const promise = (async () => {
    const t0 = performance.now();
    const buf = await fetchS3ObjectBuffer(s3Bucket, objectKey);
    const s3Ms = performance.now() - t0;
    return { buf, s3Ms };
  })();

  state.s3Inflight.set(inflightKey, promise);
  try {
    const res = await promise;
    return { ...res, shared: false };
  } finally {
    state.s3Inflight.delete(inflightKey);
  }
}

function materializeSiblingSizesInBackground(
  eventId: string,
  kind: ImageKind,
  originalBuffer: Buffer,
  alreadyRenderedWidth: ImageWidth,
): void {
  const targets: ImageWidth[] = kind === "vehicle" ? [160, 320, 640] : [160, 320];
  for (const w of targets) {
    if (w === alreadyRenderedWidth) continue;
    void (async () => {
      try {
        const path = await cacheFilePath(eventId, kind, w);
        const exists = await stat(path).then(() => true).catch(() => false);
        if (exists) return;
        const encoded = await encodeWebp(originalBuffer, w);
        await writeAtomic(path, encoded);
      } catch {
        /* best-effort sibling warm-up */
      }
    })();
  }
}

export async function resolveCachedEventImage(
  eventId: string,
  kind: ImageKind,
  width: ImageWidth,
  ifNoneMatch: string | null,
): Promise<ResolvedImageResult> {
  const etag = buildEtag(eventId, kind, width);
  const timings: ImageTimings = {
    diskMs: 0,
    dbMs: 0,
    s3Ms: 0,
    resizeMs: 0,
    source: "disk",
  };

  // 1. Check disk cache first (skips both PostgreSQL and S3 on hit!).
  const filePath = await cacheFilePath(eventId, kind, width);
  const tDisk0 = performance.now();
  try {
    if (ifNoneMatch && ifNoneMatch.split(",").map((s) => s.trim()).includes(etag)) {
      await stat(filePath);
      timings.diskMs = performance.now() - tDisk0;
      timings.source = "304";
      const now = new Date();
      void utimes(filePath, now, now).catch(() => undefined);
      return { status: "not-modified", etag, timings };
    }

    const cachedBytes = await readFile(filePath);
    timings.diskMs = performance.now() - tDisk0;
    timings.source = "disk";
    const now = new Date();
    void utimes(filePath, now, now).catch(() => undefined);
    return { status: "ok", buffer: cachedBytes, etag, timings };
  } catch {
    timings.diskMs = performance.now() - tDisk0;
  }

  // 2. Cache miss: resolve object key from 5,000-entry LRU or single parameterized DB lookup.
  const { keys, dbMs } = await lookupEventKeys(eventId);
  timings.dbMs = dbMs;
  const objectKey = kind === "vehicle" ? keys?.vehicleKey : keys?.plateKey;
  if (!keys || !objectKey) {
    timings.source = "miss";
    return { status: "not-found", timings };
  }

  // 3. Deduplicate concurrent renders for `(eventId, kind, width)`.
  const state = getState();
  const renderKey = `${eventId}:${kind}:${width}`;
  const existingRender = state.renderInflight.get(renderKey);
  if (existingRender) {
    try {
      const buffer = await existingRender;
      timings.source = "inflight";
      return { status: "ok", buffer, etag, timings };
    } catch (error) {
      if (error instanceof S3ObjectNotFoundError) {
        return { status: "not-found", timings };
      }
      throw error;
    }
  }

  const renderPromise = (async () => {
    const { buf: rawBuffer, s3Ms, shared } = await fetchOriginalDeduplicated(
      eventId,
      kind,
      keys.s3Bucket,
      objectKey,
    );
    timings.s3Ms = s3Ms;
    timings.source = shared ? "inflight" : "miss";

    const tResize0 = performance.now();
    const webp = await encodeWebp(rawBuffer, width);
    timings.resizeMs = performance.now() - tResize0;

    await writeAtomic(filePath, webp);
    materializeSiblingSizesInBackground(eventId, kind, rawBuffer, width);
    return webp;
  })();

  state.renderInflight.set(renderKey, renderPromise);
  try {
    const buffer = await renderPromise;
    return { status: "ok", buffer, etag, timings };
  } catch (error) {
    if (error instanceof S3ObjectNotFoundError) {
      return { status: "not-found", timings };
    }
    throw error;
  } finally {
    state.renderInflight.delete(renderKey);
  }
}

/**
 * Fire-and-forget warm-up invoked when a new detection arrives on `LISTEN/NOTIFY` SSE.
 * Pre-populates `vehicle` (w=160 + sibling 320/640) and `plate` (w=320 + sibling 160) on disk.
 */
export function warmEventThumbnails(eventId: string): void {
  if (!eventId || !isS3Configured()) return;
  void (async () => {
    try {
      const { keys } = await lookupEventKeys(eventId);
      if (!keys) return;
      const tasks: Array<Promise<unknown>> = [];
      if (keys.vehicleKey) {
        tasks.push(resolveCachedEventImage(eventId, "vehicle", 160, null));
      }
      if (keys.plateKey) {
        tasks.push(resolveCachedEventImage(eventId, "plate", 320, null));
      }
      await Promise.allSettled(tasks);
    } catch {
      /* never surface background warm-up errors */
    }
  })();
}
