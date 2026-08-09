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
    const eventSource = new EventSource(
      `/api/rooms/${roomId}/events?lastEventId=${lastEventIdRef.current}`,
    );

    eventSource.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "presence") {
        onPresenceRef.current?.(data.userIds);
      } else {
        const event = data as RoomEvent;
        lastEventIdRef.current = event.id;
        onEventRef.current(event);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [roomId]);
}
