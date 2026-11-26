import { evaluateAlertForDetection } from "@/lib/alerts";
import { authorize } from "@/lib/auth-server";
import { getDetectionsAfterEventId } from "@/lib/data-service";
import { subscribeLiveEvents } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function formatSse(event: string, data: unknown, id?: string): string {
  const prefix = id ? `id: ${id.replace(/[\r\n]/g, "")}\n` : "";
  return `${prefix}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const lastEventId = (request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId") ?? "").trim();
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(formatSse("hello", { connectedAt: new Date().toISOString() }));

      if (lastEventId && lastEventId.length <= 128) {
        try {
          const missed = await getDetectionsAfterEventId(lastEventId, 200);
          for (const detection of missed) {
            send(formatSse("detection", { ...detection, type: "insert" }, detection.id));
            const alert = await evaluateAlertForDetection(detection);
            if (alert) {
              send(formatSse("alert", alert, detection.id));
            }
          }
        } catch {
          /* live stream continues even if catch-up encounters a transient error */
        }
      }

      const unsubscribe = subscribeLiveEvents((message) => {
        if (message.kind === "detection") {
          send(formatSse("detection", message.payload, message.eventId));
        } else {
          send(formatSse("alert", message.payload, message.eventId));
        }
      });

      const heartbeat = setInterval(() => {
        send(": heartbeat\n\n");
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
