import { NextResponse } from "next/server";
import { answerQuestionWithRules } from "@/lib/assistant-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  } catch {
    /* handled below */
  }
  if (!question) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  try {
    return NextResponse.json(await answerQuestionWithRules(question));
  } catch {
    return NextResponse.json({ error: "The search failed. Try again in a moment." }, { status: 500 });
  }
}
