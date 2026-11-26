import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { query } from "@/lib/db";
import {
  createStreamSchema,
  isPipelineConfigured,
  listStreamsWithStatus,
  PipelineError,
  pipelineFetch,
  sanitizeStream,
} from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  try {
    const streams = await listStreamsWithStatus();
    return NextResponse.json({ configured: isPipelineConfigured(), streams });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 503;
    const message = error instanceof PipelineError ? error.message : "Could not load streams.";
    return NextResponse.json({ configured: isPipelineConfigured(), streams: [], error: message }, { status });
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const parsed = createStreamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid stream configuration.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const { location, ...pipelinePayload } = parsed.data;

  try {
    const created = await pipelineFetch<unknown>("/streams", {
      method: "POST",
      body: JSON.stringify(pipelinePayload),
    });

    // Upsert into `public.cameras` so the camera appears immediately across Dashboard & Detections.
    await query(
      `INSERT INTO public.cameras (camera_id, name, location, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (camera_id) DO UPDATE
         SET name = EXCLUDED.name,
             location = EXCLUDED.location,
             is_active = true`,
      [parsed.data.camera_id, parsed.data.name, location],
    );

    return NextResponse.json({ stream: sanitizeStream(created) }, { status: 201 });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 502;
    const message = error instanceof PipelineError ? error.message : "Could not create stream.";
    return NextResponse.json({ error: message }, { status });
  }
}
