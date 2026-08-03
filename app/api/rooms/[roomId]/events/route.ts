import { SSE_KEEPALIVE_MS, SSE_POLL_INTERVAL_MS } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { getRoomEvents } from "@/server/rooms/events";

export const runtime = "nodejs";

function encodeEvent(eventId: number, data: unknown) {
  return `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const session = await requireRequestSession();
    await requireRoomAccess(roomId, session.user.id);

    const url = new URL(request.url);
    const lastEventIdValue =
      request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId") ?? "0";
    let lastEventId = Number(lastEventIdValue) || 0;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        const flush = async () => {
          if (closed) {
            return;
          }

          const events = await getRoomEvents(roomId, lastEventId);

          for (const event of events) {
            lastEventId = event.id;
            controller.enqueue(encoder.encode(encodeEvent(event.id, event)));
          }
        };

        void flush();

        const poll = setInterval(() => {
          void flush();
        }, SSE_POLL_INTERVAL_MS);

        const keepalive = setInterval(() => {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, SSE_KEEPALIVE_MS);

        const abort = () => {
          closed = true;
          clearInterval(poll);
          clearInterval(keepalive);
          controller.close();
        };

        request.signal.addEventListener("abort", abort);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to open event stream.",
      401,
    );
  }
}
