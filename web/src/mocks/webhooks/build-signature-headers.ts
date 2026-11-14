import { faker } from "@faker-js/faker/locale/en";

import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/**
 * Standard Webhooks headers for one attempt: one signature per active
 * secret, so both sign during a rotation overlap. Mock signatures.
 */
export function buildSignatureHeaders(
  endpointRecord: WebhookEndpointRecord,
  eventId: string,
  timestampSeconds: number,
): Record<string, string> {
  const signatures = [endpointRecord.secret, endpointRecord.previous_secret]
    .filter((secret): secret is string => secret !== null)
    .map(() => `v1,${faker.string.alphanumeric(43)}=`);

  return {
    "user-agent": "sendmock/0.0.0-dev",
    "webhook-id": eventId,
    "webhook-timestamp": String(timestampSeconds),
    "webhook-signature": signatures.join(" "),
    "webhook-attempt": "1",
  };
}
