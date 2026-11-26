import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { listPipelineVideos, PipelineError, safeVideoFileSchema } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function localPublicVideos(): Promise<string[]> {
  try {
    const entries = await readdir(join(process.cwd(), "public", "videos"), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && safeVideoFileSchema.safeParse(entry.name).success)
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  try {
    const videos = await listPipelineVideos();
    return NextResponse.json({ videos });
  } catch (error) {
    const fallback = await localPublicVideos();
    const message = error instanceof PipelineError ? error.message : "Could not load video list from pipeline.";
    return NextResponse.json({ videos: fallback, error: message }, { status: fallback.length > 0 ? 200 : 503 });
  }
}
