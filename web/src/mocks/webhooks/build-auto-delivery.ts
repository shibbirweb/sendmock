import { faker } from "@faker-js/faker/locale/en";

import type {
  AppEvent,
  DeliveryTrigger,
  WebhookDelivery,
} from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/** Share of automatic deliveries the mock receiver answers with 503. */
const mockFailureRate = 0.15;

/**
 * The delivery a matching rule, or an endpoint chosen for one simulation,
 * creates for an event: usually answered 200, sometimes 503 with a retry
 * scheduled, so the log shows both.
 */
export function buildAutoDelivery({
  appEvent,
  ruleId,
  endpointRecord,
  subjectId,
  trigger,
}: {
  appEvent: AppEvent;
  ruleId: string | null;
  endpointRecord: WebhookEndpointRecord;
  subjectId: string | null;
  trigger: Extract<DeliveryTrigger, "auto" | "chosen">;
}): WebhookDelivery {
  const hasFailed = faker.number.float() < mockFailureRate;
  const firstRetryDelaySeconds =
    endpointRecord.retry_policy.backoff_seconds[0] ?? 1;

  return {
    id: createMockUlid(),
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    rule_id: ruleId,
    event_id: appEvent.id,
    event_type: appEvent.type,
    subject_id: subjectId,
    trigger,
    attempt: 1,
    status: hasFailed ? "failed" : "succeeded",
    url: endpointRecord.url,
    request: {
      method: endpointRecord.method,
      url: endpointRecord.url,
      headers: {
        "content-type": "application/json",
        "user-agent": "sendmock/0.0.0-dev",
        "webhook-id": appEvent.id,
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": `v1,${faker.string.alphanumeric(43)}=`,
        "webhook-attempt": "1",
        ...endpointRecord.headers,
      },
      body: JSON.stringify(
        {
          type: appEvent.type,
          timestamp: appEvent.created_at,
          data: appEvent.data,
        },
        null,
        2,
      ),
    },
    response: {
      status_code: hasFailed ? 503 : 200,
      headers: { "content-type": "application/json" },
      body: hasFailed ? '{"error":"Service Unavailable"}' : '{"ok":true}',
      is_body_truncated: false,
    },
    duration_ms: faker.number.int({ min: 20, max: 400 }),
    error_message: hasFailed ? "Service Unavailable" : null,
    next_attempt_at: hasFailed
      ? new Date(Date.now() + firstRetryDelaySeconds * 1000).toISOString()
      : null,
    created_at: new Date().toISOString(),
  };
}
