"use client";

import { useEffect, useRef } from "react";

import type { RoomEvent } from "@/types/rooms";

export function useRoomEvents(
  roomId: string,
  onEvent: (event: RoomEvent) => void,
  onPresence?: (userIds: string[]) => void,
) {
  const lastEventIdRef = useRef(0);
  const onEventRef = useRef(onEvent);
  const onPresenceRef = useRef(onPresence);

  useEffect(() => {
    onEventRef.current = onEvent;
    onPresenceRef.current = onPresence;
  });

  useEffect(() => {
    lastEventIdRef.current = 0;
    let eventSource: EventSource | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let isClosed = false;

    function connect() {
      if (isClosed) return;

      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(
        `/api/rooms/${roomId}/events?lastEventId=${lastEventIdRef.current}`,
      );

      eventSource.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === "presence") {
            onPresenceRef.current?.(data.userIds);
          } else {
            const event = data as RoomEvent;
            lastEventIdRef.current = event.id;
            onEventRef.current(event);
          }
        } catch (err) {
          console.error("Error parsing room event data:", err);
        }
      };

      eventSource.onerror = () => {
        if (isClosed) return;
        eventSource?.close();
        // Reconnect after 3 seconds on error / timeout
        reconnectTimeoutId = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      isClosed = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
    };
  }, [roomId]);
}
