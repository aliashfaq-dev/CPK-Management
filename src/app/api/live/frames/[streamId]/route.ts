import { NextResponse } from "next/server";
import WebSocket from "ws";
import { authorize } from "@/lib/auth-server";
import { buildFramesWsUrl, PipelineError, streamIdSchema } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRLF = Buffer.from("\r\n");

/**
 * Connects to the pipeline's binary JPEG WebSocket (`/ws/frames/{streamId}?token=...`)
 * and forwards annotated frames as `multipart/x-mixed-replace; boundary=frame` (MJPEG).
 * Only the newest frame is buffered so slow browser clients never accumulate latency.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ streamId: string }> },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const { streamId } = await context.params;
  if (!streamIdSchema.safeParse(streamId).success) {
    return NextResponse.json({ error: "Invalid stream ID." }, { status: 400 });
  }

  let wsUrl: string;
  try {
    wsUrl = buildFramesWsUrl(streamId);
  } catch (error) {
    const status = error instanceof PipelineError ? error.statusCode : 503;
    return NextResponse.json({ error: "Pipeline frame endpoint is not available." }, { status });
  }

  let cleanup: (() => void) | null = null;
  let flushPending: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let latestFrame: Buffer | null = null;
      let waitingForFrame = true;

      const writeFrame = (jpeg: Buffer) => {
        const header = Buffer.from(
          `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`,
          "ascii",
        );
        controller.enqueue(Buffer.concat([header, jpeg, CRLF]));
      };

      const flush = () => {
        if (closed || !latestFrame) return;
        if (!waitingForFrame && (controller.desiredSize === null || controller.desiredSize <= 0)) {
          return;
        }
        const jpeg = latestFrame;
        latestFrame = null;
        waitingForFrame = false;
        try {
          writeFrame(jpeg);
        } catch {
          closeAll();
        }
      };
      flushPending = () => {
        waitingForFrame = true;
        flush();
      };

      const socket = new WebSocket(wsUrl, { handshakeTimeout: 8_000 });

      function closeAll() {
        if (closed) return;
        closed = true;
        latestFrame = null;
        socket.removeAllListeners();
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.terminate();
        }
        try {
          controller.close();
        } catch {
          /* stream already closed */
        }
      }
      cleanup = closeAll;

      socket.on("message", (data, isBinary) => {
        if (!isBinary && !Buffer.isBuffer(data)) return;
        const jpeg = Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data as ArrayBuffer);
        if (jpeg.length === 0) return;
        latestFrame = jpeg;
        flush();
      });

      socket.on("error", closeAll);
      socket.on("close", closeAll);
      request.signal.addEventListener("abort", closeAll, { once: true });
    },
    pull() {
      flushPending?.();
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
