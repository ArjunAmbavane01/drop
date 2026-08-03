"use client";

import { useEffect, useRef } from "react";

import type { RoomEvent } from "@/types/rooms";

export function useRoomEvents(
  roomId: string,
  onEvent: (event: RoomEvent) => void,
) {
  const lastEventIdRef = useRef(0);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/rooms/${roomId}/events?lastEventId=${lastEventIdRef.current}`,
    );

    eventSource.onmessage = (message) => {
      const event = JSON.parse(message.data) as RoomEvent;
      lastEventIdRef.current = event.id;
      onEvent(event);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [onEvent, roomId]);
}
