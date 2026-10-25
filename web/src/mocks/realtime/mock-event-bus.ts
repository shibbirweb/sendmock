import { ws } from "msw";

import { buildRealtimeUrl } from "@/lib/api/api-client";
import type { AppEvent, AppEventType } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

/** Intercepts the app's realtime WebSocket so mock events reach the UI. */
export const realtimeLink = ws.link(buildRealtimeUrl());

export const realtimeConnectionHandler = realtimeLink.addEventListener(
  "connection",
  ({ client }) => {
    client.send(
      JSON.stringify({
        id: `evt_${createMockUlid()}`,
        type: "test.ping",
        created_at: new Date().toISOString(),
        data: { message: "Connected to the mock event stream" },
      } satisfies AppEvent),
    );
  },
);

type MockEventListener = (appEvent: AppEvent) => void;

const mockEventListeners = new Set<MockEventListener>();

/** Server-side subscribers (webhook rules), like the backend's event bus. */
export function subscribeToMockEvents(
  mockEventListener: MockEventListener,
): () => void {
  mockEventListeners.add(mockEventListener);

  return () => {
    mockEventListeners.delete(mockEventListener);
  };
}

/** Sends an event to every connected UI tab and every server-side subscriber. */
export function publishMockEvent(
  eventType: AppEventType | string,
  eventData: Record<string, unknown>,
) {
  const appEvent: AppEvent = {
    id: `evt_${createMockUlid()}`,
    type: eventType as AppEventType,
    created_at: new Date().toISOString(),
    data: eventData,
  };

  realtimeLink.broadcast(JSON.stringify(appEvent));
  for (const mockEventListener of mockEventListeners) {
    mockEventListener(appEvent);
  }
}
