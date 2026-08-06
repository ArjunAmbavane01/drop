"use client";

import { useEffect, useRef } from "react";

import type { RoomEvent } from "@/types/rooms";

export function useRoomEvents(
  roomId: string,
  onEvent: (event: RoomEvent) => void,
  onPresence?: (userIds: string[]) => void,
) {
  const lastEventIdRef = useRef(0);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/rooms/${roomId}/events?lastEventId=${lastEventIdRef.current}`,
    );

    eventSource.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "presence") {
        onPresence?.(data.userIds);
      } else {
        const event = data as RoomEvent;
        lastEventIdRef.current = event.id;
        onEvent(event);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [onEvent, roomId]);
}
