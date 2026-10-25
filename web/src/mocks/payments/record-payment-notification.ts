import { faker } from "@faker-js/faker/locale/en";

import type { PaymentDetail, WebhookDelivery } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { paymentEndpointName } from "@/mocks/fixtures/webhook-fixtures";
import {
  buildProviderNotification,
  type PaymentEventType,
} from "@/mocks/payments/provider-notifications";
import { buildSignatureHeaders } from "@/mocks/webhooks/build-signature-headers";

/**
 * Sends a payment's notification to its provider's notification endpoint
 * as a delivery in the webhook log, and notes it on the payment (PY-08.3).
 */
export function recordPaymentNotification(
  mockDatabase: Pick<MockDatabase, "webhookEndpoints" | "webhookDeliveries">,
  paymentDetail: PaymentDetail,
  eventType: PaymentEventType,
  createdAtMs: number = Date.now(),
): WebhookDelivery | null {
  const endpointRecord = mockDatabase.webhookEndpoints.find(
    (webhookEndpoint) => webhookEndpoint.name === paymentEndpointName,
  );
  if (endpointRecord === undefined) {
    return null;
  }

  const timestampSeconds = Math.floor(createdAtMs / 1000);
  const eventId = `evt_${createMockUlid(createdAtMs)}`;
  const providerNotification = buildProviderNotification(
    paymentDetail,
    eventType,
    timestampSeconds,
  );
  const createdAt = new Date(createdAtMs).toISOString();
  const notificationDelivery: WebhookDelivery = {
    id: createMockUlid(createdAtMs),
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    rule_id: null,
    event_id: eventId,
    event_type: eventType,
    subject_id: paymentDetail.id,
    trigger: "auto",
    attempt: 1,
    status: "succeeded",
    request: {
      method: "POST",
      url: endpointRecord.url,
      headers: {
        ...providerNotification.headers,
        ...(paymentDetail.provider === "native"
          ? buildSignatureHeaders(endpointRecord, eventId, timestampSeconds)
          : { "user-agent": "sendmock/0.0.0-dev" }),
      },
      body: providerNotification.body,
    },
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"received":true}',
      is_body_truncated: false,
    },
    duration_ms: faker.number.int({ min: 20, max: 160 }),
    error_message: null,
    next_attempt_at: null,
    created_at: createdAt,
  };
  mockDatabase.webhookDeliveries.unshift(notificationDelivery);
  paymentDetail.notifications.push({
    delivery_id: notificationDelivery.id,
    event_type: eventType,
    provider_event_name: providerNotification.providerEventName,
    status: notificationDelivery.status,
    status_code: 200,
    created_at: createdAt,
  });
  paymentDetail.timeline.push({
    kind: "notification_sent",
    description: `Sent ${providerNotification.providerEventName} to ${endpointRecord.name}`,
    created_at: createdAt,
  });

  return notificationDelivery;
}
