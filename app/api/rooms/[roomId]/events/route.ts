import { SSE_KEEPALIVE_MS, SSE_POLL_INTERVAL_MS } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { requireRequestSession } from "@/server/auth/request";
import { requireRoomAccess } from "@/server/rooms/auth";
import { getRoomEvents } from "@/server/rooms/events";

export const runtime = "nodejs";

function encodeEvent(eventId: number, data: unknown) {
  return `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Global map of room presence: roomId -> Map of userId -> Set of controllers
const roomClients = new Map<string, Map<string, Set<ReadableStreamDefaultController>>>();

function broadcastPresence(roomId: string) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const onlineUserIds = Array.from(clients.keys());
  const payload = JSON.stringify({ type: "presence", userIds: onlineUserIds });
  const message = `data: ${payload}\n\n`;

  const encoder = new TextEncoder();
  for (const userMap of clients.values()) {
    for (const controller of userMap) {
      try {
        controller.enqueue(encoder.encode(message));
      } catch {
        // Ignored
      }
    }
  }
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

        // Register client presence
        if (!roomClients.has(roomId)) {
          roomClients.set(roomId, new Map());
        }
        const userMap = roomClients.get(roomId)!;
        if (!userMap.has(session.user.id)) {
          userMap.set(session.user.id, new Set());
        }
        userMap.get(session.user.id)!.add(controller);

        // Broadcast current presence status
        broadcastPresence(roomId);

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
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {}
        }, SSE_KEEPALIVE_MS);

        const abort = () => {
          closed = true;
          clearInterval(poll);
          clearInterval(keepalive);

          // Unregister client presence
          const userMap = roomClients.get(roomId);
          if (userMap) {
            const controllers = userMap.get(session.user.id);
            if (controllers) {
              controllers.delete(controller);
              if (controllers.size === 0) {
                userMap.delete(session.user.id);
              }
            }
            if (userMap.size === 0) {
              roomClients.delete(roomId);
            }
          }

          // Broadcast updated presence status
          broadcastPresence(roomId);

          try {
            controller.close();
          } catch {}
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
