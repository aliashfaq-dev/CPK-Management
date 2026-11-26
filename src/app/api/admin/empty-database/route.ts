import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth-server";
import { query, withTransaction } from "@/lib/db";
import { deletePrefixesInBatches, getDefaultBucket, isS3Configured } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_SETTING_KEY = "empty_database_audit";

export interface EmptyDatabaseAuditEntry {
  at: string;
  userId: string;
  email: string;
  eventsRemoved: number;
  runsRemoved: number;
  deleteImages: boolean;
  s3ObjectsDeleted: number;
}

export async function GET(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  try {
    const result = await query<{ value: unknown }>(
      "SELECT value FROM public.app_settings WHERE key = $1 LIMIT 1",
      [AUDIT_SETTING_KEY],
    );
    const history = Array.isArray(result.rows[0]?.value)
      ? (result.rows[0].value as EmptyDatabaseAuditEntry[])
      : [];
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}

const bodySchema = z.object({
  confirm: z.literal("DELETE"),
  deleteImages: z.boolean(),
});

/**
 * Admin-only danger zone endpoint:
 * - Truncates `public.events` and `public.runs` inside a single transaction.
 * - Leaves `cameras`, `app_users`, `watchlist`, and `app_settings` untouched.
 * - Optionally deletes S3 event snapshots/manifests under camera prefixes and `runs/` in batches.
 * - Appends an immutable audit record to `public.app_settings` (`empty_database_audit`).
 */
export async function POST(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Type "DELETE" to confirm emptying the detection database.' },
      { status: 400 },
    );
  }

  const { deleteImages } = parsed.data;
  if (deleteImages && !isS3Configured()) {
    return NextResponse.json(
      { error: "S3 credentials are not configured on the server; uncheck image deletion or configure S3 first." },
      { status: 400 },
    );
  }

  // Gather bucket + prefixes before truncating so event-specific buckets/prefixes are known.
  let bucketsToClean = new Map<string, Set<string>>();
  if (deleteImages) {
    const defaultBucket = getDefaultBucket();
    const [camRows, prefixRows] = await Promise.all([
      query<{ camera_id: string }>("SELECT camera_id FROM public.cameras"),
      query<{ bucket: string | null; prefix: string | null }>(`
        SELECT DISTINCT
          COALESCE(NULLIF(s3_bucket, ''), $1) AS bucket,
          split_part(COALESCE(NULLIF(vehicle_key, ''), NULLIF(plate_key, '')), '/', 1) AS prefix
        FROM public.events
        UNION
        SELECT DISTINCT $1 AS bucket, camera_id AS prefix FROM public.events WHERE camera_id IS NOT NULL`,
        [defaultBucket],
      ),
    ]);

    bucketsToClean = new Map<string, Set<string>>();
    const ensureSet = (b: string) => {
      let s = bucketsToClean.get(b);
      if (!s) {
        s = new Set<string>(["runs/"]);
        bucketsToClean.set(b, s);
      }
      return s;
    };

    if (defaultBucket) {
      const baseSet = ensureSet(defaultBucket);
      for (const cam of camRows.rows) {
        if (cam.camera_id?.trim()) baseSet.add(`${cam.camera_id.trim()}/`);
      }
    }
    for (const row of prefixRows.rows) {
      const bucket = row.bucket?.trim() || defaultBucket;
      if (!bucket) continue;
      const set = ensureSet(bucket);
      const cleanPrefix = row.prefix?.trim().replace(/^\/+|\/+$/g, "");
      if (cleanPrefix) set.add(`${cleanPrefix}/`);
    }
  }

  let s3ObjectsDeleted = 0;
  if (deleteImages) {
    try {
      for (const [bucket, prefixSet] of bucketsToClean) {
        s3ObjectsDeleted += await deletePrefixesInBatches(bucket, Array.from(prefixSet));
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to delete objects from S3 storage; database tables were not truncated." },
        { status: 502 },
      );
    }
  }

  const auditedAt = new Date().toISOString();
  const { eventsRemoved, runsRemoved, entry } = await withTransaction(async (client) => {
    const counts = await client.query<{ events_count: string; runs_count: string }>(
      "SELECT (SELECT COUNT(*) FROM public.events) AS events_count, (SELECT COUNT(*) FROM public.runs) AS runs_count",
    );
    const evCount = Number(counts.rows[0]?.events_count ?? 0);
    const runCount = Number(counts.rows[0]?.runs_count ?? 0);

    await client.query("TRUNCATE TABLE public.events, public.runs");

    const auditEntry: EmptyDatabaseAuditEntry = {
      at: auditedAt,
      userId: auth.user.id,
      email: auth.user.email,
      eventsRemoved: evCount,
      runsRemoved: runCount,
      deleteImages,
      s3ObjectsDeleted,
    };

    await client.query(
      `INSERT INTO public.app_settings (key, value)
       VALUES ($1, jsonb_build_array($2::jsonb))
       ON CONFLICT (key) DO UPDATE
         SET value = (jsonb_build_array($2::jsonb) || CASE WHEN jsonb_typeof(public.app_settings.value) = 'array' THEN public.app_settings.value ELSE '[]'::jsonb END)`,
      [AUDIT_SETTING_KEY, JSON.stringify(auditEntry)],
    );

    return { eventsRemoved: evCount, runsRemoved: runCount, entry: auditEntry };
  });

  return NextResponse.json({
    ok: true,
    eventsRemoved,
    runsRemoved,
    s3ObjectsDeleted,
    audit: entry,
  });
}
