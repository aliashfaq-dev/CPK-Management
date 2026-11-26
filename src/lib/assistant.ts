/**
 * Client side of the assistant. The question goes to POST /api/assistant, which turns it into
 * structured filters and runs a parameterized query. Nothing here talks to a database or an LLM.
 */
import type { Detection } from "@/types";

export interface AssistantReply {
  text: string;
  results: Detection[];
  total: number;
  href?: string;
}

export async function askAssistant(question: string): Promise<AssistantReply> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    let message = "The search failed. Check your connection and send the question again.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep the default message */
    }
    throw new Error(message);
  }
  return (await response.json()) as AssistantReply;
}
