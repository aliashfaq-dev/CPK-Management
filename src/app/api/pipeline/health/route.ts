import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { isPipelineConfigured, PipelineError, pipelineFetch } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  try {
    const health = await pipelineFetch<Record<string, unknown>>("/health");
    return NextResponse.json({ ok: true, configured: isPipelineConfigured(), health });
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 503;
    const message = error instanceof PipelineError ? error.message : "Pipeline health check failed.";
    return NextResponse.json({ ok: false, configured: isPipelineConfigured(), error: message }, { status });
  }
}
