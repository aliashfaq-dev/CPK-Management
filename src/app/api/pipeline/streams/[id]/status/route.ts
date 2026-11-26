import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { PipelineError, pipelineFetch, sanitizeStatus, streamIdSchema } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!streamIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid stream ID." }, { status: 400 });
  }

  try {
    const raw = await pipelineFetch<unknown>(`/streams/${encodeURIComponent(id)}/status`);
    return NextResponse.json({ status: sanitizeStatus(raw) });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 502;
    const message = error instanceof PipelineError ? error.message : "Could not load stream status.";
    return NextResponse.json({ error: message }, { status });
  }
}
