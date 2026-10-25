import { faker } from "@faker-js/faker/locale/en";

import type { WebhookDelivery } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { buildSignatureHeaders } from "@/mocks/webhooks/build-signature-headers";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/**
 * A `test.ping` delivery as the server would record it (WH-01.2): signed
 * with Standard Webhooks headers, answered 200 by the mock receiver.
 */
export function buildTestDelivery(
  endpointRecord: WebhookEndpointRecord,
): WebhookDelivery {
  const eventId = `evt_${createMockUlid()}`;
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const requestBody = JSON.stringify({
    type: "test.ping",
    timestamp: new Date(timestampSeconds * 1000).toISOString(),
    data: { endpoint: endpointRecord.name, message: "Hello from SendMock" },
  });
  return {
    id: createMockUlid(),
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    rule_id: null,
    event_id: eventId,
    event_type: "test.ping",
    subject_id: null,
    trigger: "manual",
    attempt: 1,
    status: "succeeded",
    request: {
      method: endpointRecord.method,
      url: endpointRecord.url,
      headers: {
        "content-type": "application/json",
        ...buildSignatureHeaders(endpointRecord, eventId, timestampSeconds),
        ...endpointRecord.headers,
      },
      body: requestBody,
    },
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"received":true}',
      is_body_truncated: false,
    },
    duration_ms: faker.number.int({ min: 24, max: 180 }),
    error_message: null,
    next_attempt_at: null,
    created_at: new Date().toISOString(),
  };
}
