import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateAlertCache, listWatchlist } from "@/lib/alerts";
import { authorize } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { normalizePlate } from "@/lib/detection-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  try {
    const entries = await listWatchlist();
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Could not load the watchlist." }, { status: 500 });
  }
}

const createSchema = z.object({
  plate: z.string().trim().min(1).max(24),
  note: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid license plate." }, { status: 400 });
  }

  const plateNorm = normalizePlate(parsed.data.plate);
  if (plateNorm.length < 2 || plateNorm.length > 15) {
    return NextResponse.json({ error: "Plate must contain between 2 and 15 letters or digits." }, { status: 400 });
  }
  const note = parsed.data.note ? parsed.data.note : null;

  const result = await query<{ id: string; plate_norm: string; note: string | null; created_at: Date }>(
    `INSERT INTO public.watchlist (plate_norm, note)
     VALUES ($1, $2)
     ON CONFLICT (plate_norm) DO UPDATE SET note = COALESCE(EXCLUDED.note, public.watchlist.note)
     RETURNING id, plate_norm, note, created_at`,
    [plateNorm, note],
  );
  invalidateAlertCache();
  const row = result.rows[0];
  return NextResponse.json(
    {
      entry: {
        id: row.id,
        plateNorm: row.plate_norm,
        note: row.note,
        createdAt: row.created_at.toISOString(),
      },
    },
    { status: 201 },
  );
}
