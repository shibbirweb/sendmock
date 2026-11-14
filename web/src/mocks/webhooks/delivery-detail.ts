import type {
  DeliverySubject,
  WebhookDelivery,
  WebhookDeliveryDetail,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";

function findDeliverySubject(
  mockDatabase: MockDatabase,
  webhookDelivery: WebhookDelivery,
): DeliverySubject | null {
  if (webhookDelivery.subject_id === null) {
    return null;
  }

  const email = mockDatabase.emails.find(
    (existingEmail) => existingEmail.id === webhookDelivery.subject_id,
  );
  if (email !== undefined) {
    return {
      kind: "email",
      id: email.id,
      title: email.subject,
      sms_thread_id: null,
    };
  }

  const smsMessage = mockDatabase.smsMessages.find(
    (existingMessage) => existingMessage.id === webhookDelivery.subject_id,
  );
  if (smsMessage !== undefined) {
    const isOutbound = smsMessage.direction === "outbound";
    const threadNumbers = isOutbound
      ? `${smsMessage.from_number}|${smsMessage.to_number}`
      : `${smsMessage.to_number}|${smsMessage.from_number}`;

    return {
      kind: "sms",
      id: smsMessage.id,
      title: smsMessage.body,
      sms_thread_id: threadNumbers,
    };
  }

  return null;
}

/** A delivery with its attempts, retry limit and causing message (WH-03.8). */
export function buildDeliveryDetail(
  mockDatabase: MockDatabase,
  webhookDelivery: WebhookDelivery,
): WebhookDeliveryDetail {
  const endpointRecord = mockDatabase.webhookEndpoints.find(
    (existingEndpoint) => existingEndpoint.id === webhookDelivery.endpoint_id,
  );
  const attempts = mockDatabase.webhookDeliveries
    .filter(
      (otherDelivery) =>
        otherDelivery.event_id === webhookDelivery.event_id &&
        otherDelivery.endpoint_id === webhookDelivery.endpoint_id &&
        otherDelivery.trigger === webhookDelivery.trigger,
    )
    .sort(
      (firstAttempt, secondAttempt) =>
        firstAttempt.attempt - secondAttempt.attempt,
    )
    .map((attemptDelivery) => ({
      delivery_id: attemptDelivery.id,
      attempt: attemptDelivery.attempt,
      status: attemptDelivery.status,
      status_code: attemptDelivery.response?.status_code ?? null,
      created_at: attemptDelivery.created_at,
    }));

  return {
    ...webhookDelivery,
    max_attempts:
      endpointRecord?.retry_policy.max_attempts ?? webhookDelivery.attempt,
    attempts,
    subject: findDeliverySubject(mockDatabase, webhookDelivery),
  };
}
