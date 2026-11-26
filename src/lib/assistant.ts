/**
 * Client side of the AI search box. Sends the question + up to the last 3 validated filter JSON
 * objects (never raw DB rows) to POST /api/assistant.
 */
import type { AppliedFilterChip, RawAiFilter } from "@/lib/ai-search-core";
import type { Detection } from "@/types";

export interface AssistantGroupRow {
  label: string;
  count: number;
}

export interface AssistantReply {
  text: string;
  results: Detection[];
  total: number;
  chips: AppliedFilterChip[];
  groups?: AssistantGroupRow[];
  appliedFilter?: RawAiFilter;
  href?: string;
  exportHref?: string;
  unavailable?: boolean;
}

export async function askAssistant(
  question: string,
  history: RawAiFilter[] = [],
): Promise<AssistantReply> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      history: history.slice(-3),
    }),
  });
  if (!response.ok) {
    let message = "AI search abhi available nahi.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep fallback message */
    }
    throw new Error(message);
  }
  return (await response.json()) as AssistantReply;
}
