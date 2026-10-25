import { faker } from "@faker-js/faker/locale/en";

import type {
  PaymentDetail,
  PaymentEventType,
  WebhookDelivery,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { findGatewayRecord } from "@/mocks/payments/payment-gateway-record";
import { renderGatewayNotification } from "@/mocks/payments/render-gateway-templates";
import { buildSignatureHeaders } from "@/mocks/webhooks/build-signature-headers";

/**
 * Sends a payment's notification, rendered from its gateway's templates, to
 * the gateway's notification endpoint as a delivery in the webhook log, and
 * notes it on the payment (PY-08.3, PY-12.3). Nothing is sent when the
 * gateway names no event for it or has no endpoint.
 */
export function recordPaymentNotification(
  mockDatabase: Pick<
    MockDatabase,
    "webhookEndpoints" | "webhookDeliveries" | "paymentGateways"
  >,
  paymentDetail: PaymentDetail,
  eventType: PaymentEventType,
  createdAtMs: number = Date.now(),
): WebhookDelivery | null {
  const paymentGateway = findGatewayRecord(
    mockDatabase,
    paymentDetail.provider,
  );
  const endpointRecord = mockDatabase.webhookEndpoints.find(
    (webhookEndpoint) =>
      webhookEndpoint.id === paymentGateway?.notification_endpoint_id,
  );
  if (paymentGateway === undefined || endpointRecord === undefined) {
    return null;
  }

  const timestampSeconds = Math.floor(createdAtMs / 1000);
  const eventId = `evt_${createMockUlid(createdAtMs)}`;
  const providerNotification = renderGatewayNotification(
    paymentGateway,
    paymentDetail,
    {
      eventType,
      redirectOutcome: "success",
      eventId,
      timestampSeconds,
      shouldMaskSecrets: false,
    },
  );
  if (providerNotification === null) {
    return null;
  }
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
        // Native signs with the endpoint's own secret (Standard Webhooks).
        ...(paymentGateway.key === "native"
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
    provider_event_name: providerNotification.eventName,
    status: notificationDelivery.status,
    status_code: 200,
    created_at: createdAt,
  });
  paymentDetail.timeline.push({
    kind: "notification_sent",
    description: `Sent ${providerNotification.eventName} to ${endpointRecord.name}`,
    created_at: createdAt,
  });

  return notificationDelivery;
}
