"use client";

import { useEffect, useState } from "react";

import type { PlaygroundEvent } from "./bridge-messages";
import type { PlaygroundTarget } from "./local-instance";

/**
 * Events from a connected SendMock's SSE stream, newest last. EventSource cannot send a
 * token, so an instance with UI auth shows none.
 */
export function useInstanceEvents(
  connectedTarget: Extract<PlaygroundTarget, { kind: "instance" }> | null,
): PlaygroundEvent[] {
  const [instanceEvents, setInstanceEvents] = useState<PlaygroundEvent[]>([]);
  const eventStreamUrl =
    connectedTarget === null || connectedTarget.apiToken
      ? null
      : `${connectedTarget.baseUrl.replace(/\/+$/, "")}/api/v1/events`;

  useEffect(() => {
    setInstanceEvents([]);
    if (eventStreamUrl === null) {
      return;
    }
    const eventSource = new EventSource(eventStreamUrl);
    eventSource.onmessage = (messageEvent) => {
      try {
        const playgroundEvent = JSON.parse(
          String(messageEvent.data),
        ) as PlaygroundEvent;
        setInstanceEvents((previousEvents) => [
          ...previousEvents.slice(-99),
          playgroundEvent,
        ]);
      } catch {
        // Keep-alive comments and anything that is not an event are skipped.
      }
    };
    return () => eventSource.close();
  }, [eventStreamUrl]);

  return instanceEvents;
}
