import { performance } from "node:perf_hooks";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import {
  ALLOWED_IMAGE_WIDTHS,
  resolveCachedEventImage,
  type ImageKind,
  type ImageTimings,
  type ImageWidth,
} from "@/lib/image-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMMUTABLE_CACHE_CONTROL = "private, max-age=31536000, immutable";

function buildServerTimingHeader(authMs: number, timings: ImageTimings, totalMs: number): string {
  return [
    `auth;dur=${authMs.toFixed(1)}`,
    `disk;dur=${timings.diskMs.toFixed(1)}`,
    `db;dur=${timings.dbMs.toFixed(1)}`,
    `s3;dur=${timings.s3Ms.toFixed(1)}`,
    `resize;dur=${timings.resizeMs.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)};desc="${timings.source}"`,
  ].join(", ");
}

/**
 * Serves resized WebP snapshots (`vehicle` or `plate`) from local disk cache (`.cache/images`),
 * fetching from S3 and encoding via `sharp` only on the very first miss.
 *
 * Query params:
 * - `w`: `160 | 320 | 640 | 0` (0 = original dimensions in WebP; defaults: 640 for vehicle, 320 for plate).
 *   Any other `w` value is rejected with HTTP 400.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string; kind: string }> },
) {
  const tStart = performance.now();

  const tAuth0 = performance.now();
  const auth = await authorize(request);
  const authMs = performance.now() - tAuth0;
  if ("response" in auth) return auth.response;

  const { eventId, kind } = await context.params;
  if ((kind !== "vehicle" && kind !== "plate") || !eventId || eventId.length > 128) {
    return new NextResponse(null, { status: 404 });
  }

  const wParam = new URL(request.url).searchParams.get("w");
  let width: ImageWidth;
  if (wParam === null || wParam === "") {
    width = kind === "plate" ? 320 : 640;
  } else {
    if (!/^\d+$/.test(wParam)) {
      return NextResponse.json({ error: "Width w must be one of 160, 320, 640, or 0." }, { status: 400 });
    }
    const parsedW = Number(wParam);
    if (!ALLOWED_IMAGE_WIDTHS.has(parsedW)) {
      return NextResponse.json({ error: "Width w must be one of 160, 320, 640, or 0." }, { status: 400 });
    }
    width = parsedW as ImageWidth;
  }

  const ifNoneMatch = request.headers.get("if-none-match");

  try {
    const resolved = await resolveCachedEventImage(
      eventId,
      kind as ImageKind,
      width,
      ifNoneMatch,
    );
    const totalMs = performance.now() - tStart;
    const serverTiming = buildServerTimingHeader(authMs, resolved.timings, totalMs);

    if (process.env.NODE_ENV !== "production") {
      console.debug(
        `[api/images] ${eventId}/${kind}?w=${width} -> ${resolved.status} (${resolved.timings.source}) total=${totalMs.toFixed(1)}ms [auth=${authMs.toFixed(1)} disk=${resolved.timings.diskMs.toFixed(1)} db=${resolved.timings.dbMs.toFixed(1)} s3=${resolved.timings.s3Ms.toFixed(1)} resize=${resolved.timings.resizeMs.toFixed(1)}]`,
      );
    }

    if (resolved.status === "not-found") {
      return new NextResponse(null, {
        status: 404,
        headers: { "Server-Timing": serverTiming },
      });
    }

    if (resolved.status === "not-modified") {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: resolved.etag,
          "Cache-Control": IMMUTABLE_CACHE_CONTROL,
          "Server-Timing": serverTiming,
        },
      });
    }

    return new NextResponse(new Uint8Array(resolved.buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(resolved.buffer.length),
        ETag: resolved.etag,
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
        "Server-Timing": serverTiming,
      },
    });
  } catch {
    return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });
  }
}
