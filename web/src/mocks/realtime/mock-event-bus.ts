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

/** Sends an event to every connected UI tab, like the server's event bus. */
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
}
