import { faker } from "@faker-js/faker/locale/en";

import type { DeliveryReplayRequest, WebhookDelivery } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

/**
 * A replay of a stored request: as-is, re-rendered (fresh timestamp and
 * signature, as fresh variable values would give), or with an edited body
 * and headers (WH-05.2). The mock receiver answers 200.
 */
export function buildReplayDelivery(
  originalDelivery: WebhookDelivery,
  replayRequest: DeliveryReplayRequest,
): WebhookDelivery | null {
  if (originalDelivery.request === null) {
    return null;
  }

  const eventId = `evt_${createMockUlid()}`;
  const freshHeaders: Record<string, string> = replayRequest.rerender
    ? {
        "webhook-id": eventId,
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": `v1,${faker.string.alphanumeric(43)}=`,
      }
    : {};

  return {
    ...originalDelivery,
    id: createMockUlid(),
    event_id: eventId,
    trigger: "replay",
    attempt: 1,
    status: "succeeded",
    request: {
      ...originalDelivery.request,
      headers: replayRequest.headers ?? {
        ...originalDelivery.request.headers,
        ...freshHeaders,
      },
      body: replayRequest.body ?? originalDelivery.request.body,
    },
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
      is_body_truncated: false,
    },
    duration_ms: faker.number.int({ min: 20, max: 300 }),
    error_message: null,
    next_attempt_at: null,
    created_at: new Date().toISOString(),
  };
}
