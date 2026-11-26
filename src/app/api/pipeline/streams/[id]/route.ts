import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { patchStreamSchema, PipelineError, pipelineFetch, sanitizeStream, streamIdSchema } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!streamIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid stream ID." }, { status: 400 });
  }

  const parsed = patchStreamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update payload." }, { status: 400 });
  }

  try {
    const updated = await pipelineFetch<unknown>(`/streams/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    return NextResponse.json({ stream: sanitizeStream(updated) });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 502;
    const message = error instanceof PipelineError ? error.message : "Could not update stream.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!streamIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid stream ID." }, { status: 400 });
  }

  try {
    await pipelineFetch(`/streams/${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 502;
    const message = error instanceof PipelineError ? error.message : "Could not delete stream.";
    return NextResponse.json({ error: message }, { status });
  }
}
