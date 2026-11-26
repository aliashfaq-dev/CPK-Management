import { NextResponse } from "next/server";
import { z } from "zod";
import { aiFilterSchema } from "@/lib/ai-search-core";
import { answerAssistantQuestion } from "@/lib/assistant-search";
import { authorize } from "@/lib/auth-server";
import { createLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~20 requests per minute per authenticated user.
const userLimiter = createLimiter("assistant-user", 20, 60_000);

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(aiFilterSchema).max(3).optional(),
});

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const throttle = userLimiter.hit(auth.user.id);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many AI searches. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a search question." }, { status: 400 });
  }

  try {
    const reply = await answerAssistantQuestion(parsed.data.question, parsed.data.history ?? []);
    return NextResponse.json(reply);
  } catch {
    return NextResponse.json({ error: "AI search abhi available nahi." }, { status: 503 });
  }
}
