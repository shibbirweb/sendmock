import { faker } from "@faker-js/faker/locale/en";

import type { SavedDelivery, WebhookDelivery } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/** Headers SendMock writes on every send; never kept in exports. */
export const signatureHeaderPrefix = "webhook-";

/**
 * Sends a saved request to an endpoint (WH-10.2): the endpoint's method and
 * URL, the stored body, and fresh signature headers when re-rendered. The
 * mock receiver answers 200.
 */
export function buildSavedSendDelivery(
  savedDelivery: SavedDelivery,
  endpointRecord: WebhookEndpointRecord,
  shouldRerender: boolean,
): WebhookDelivery {
  const eventId = `evt_${createMockUlid()}`;
  const storedHeaders = savedDelivery.request.headers;
  const freshHeaders: Record<string, string> = shouldRerender
    ? {
        "webhook-id": eventId,
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": `v1,${faker.string.alphanumeric(43)}=`,
      }
    : {};

  return {
    id: createMockUlid(),
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    rule_id: null,
    event_id: eventId,
    event_type: savedDelivery.event_type ?? "test.ping",
    subject_id: null,
    trigger: "manual",
    attempt: 1,
    status: "succeeded",
    request: {
      method: endpointRecord.method,
      url: endpointRecord.url,
      headers: { ...storedHeaders, ...freshHeaders },
      body: savedDelivery.request.body,
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
