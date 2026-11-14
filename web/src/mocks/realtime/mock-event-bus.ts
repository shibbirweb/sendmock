import { ws } from "msw";

import { buildRealtimeUrl } from "@/lib/api/api-client";
import type { AppEvent, AppEventType } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  type ActiveWebhookChoice,
  readActiveWebhookChoice,
} from "@/mocks/realtime/webhook-choice-scope";

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

/** Listeners get what the publishing action chose for its webhooks, or null. */
type MockEventListener = (
  appEvent: AppEvent,
  webhookChoice: ActiveWebhookChoice | null,
) => void;

const mockEventListeners = new Set<MockEventListener>();

const recentEventLimit = 200;
const recentEvents: AppEvent[] = [];

/** The latest published events, newest first, for `GET /events/recent`. */
export function listRecentMockEvents(): AppEvent[] {
  return [...recentEvents];
}

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

  recentEvents.unshift(appEvent);
  recentEvents.length = Math.min(recentEvents.length, recentEventLimit);
  realtimeLink.broadcast(JSON.stringify(appEvent));
  const webhookChoice = readActiveWebhookChoice();
  for (const mockEventListener of mockEventListeners) {
    mockEventListener(appEvent, webhookChoice);
  }
}
