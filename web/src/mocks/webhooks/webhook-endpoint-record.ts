import { faker } from "@faker-js/faker/locale/en";

import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/types";
import { calculateSuccessRate } from "@/mocks/stats/delivery-metrics";

/**
 * An endpoint as the server stores it: the plain secrets, never sent to
 * the UI, and without the figures computed from deliveries.
 */
export type WebhookEndpointRecord = Omit<
  WebhookEndpoint,
  "masked_secret" | "success_rate" | "delivery_count_24h" | "success_history"
> & {
  secret: string;
  previous_secret: string | null;
};

const hourInMs = 60 * 60 * 1000;
const historyHourCount = 24;

/** A Standard Webhooks secret: `whsec_` and base64 of random bytes. */
export function generateEndpointSecret(): string {
  return `whsec_${faker.string.alphanumeric(32)}`;
}

/** "whsec_••••3f9a": enough to tell secrets apart, never the secret (WH-01.3). */
export function maskEndpointSecret(secret: string): string {
  return `whsec_••••${secret.slice(-4)}`;
}

function buildSuccessHistory(
  endpointDeliveries: WebhookDelivery[],
  nowMs: number,
): (number | null)[] {
  const currentHourStartMs = Math.floor(nowMs / hourInMs) * hourInMs;
  const firstHourStartMs =
    currentHourStartMs - (historyHourCount - 1) * hourInMs;

  return Array.from({ length: historyHourCount }, (_, hourIndex) => {
    const hourStartMs = firstHourStartMs + hourIndex * hourInMs;

    return calculateSuccessRate(
      endpointDeliveries.filter((webhookDelivery) => {
        const createdAtMs = Date.parse(webhookDelivery.created_at);

        return (
          createdAtMs >= hourStartMs && createdAtMs < hourStartMs + hourInMs
        );
      }),
    );
  });
}

/** What the API returns for an endpoint: masked secret plus 24-hour figures. */
export function presentWebhookEndpoint(
  endpointRecord: WebhookEndpointRecord,
  webhookDeliveries: WebhookDelivery[],
  nowMs: number,
): WebhookEndpoint {
  const windowStartMs = nowMs - historyHourCount * hourInMs;
  const recentDeliveries = webhookDeliveries.filter(
    (webhookDelivery) =>
      webhookDelivery.endpoint_id === endpointRecord.id &&
      Date.parse(webhookDelivery.created_at) >= windowStartMs,
  );
  return {
    id: endpointRecord.id,
    name: endpointRecord.name,
    url: endpointRecord.url,
    method: endpointRecord.method,
    headers: endpointRecord.headers,
    extra_fields: endpointRecord.extra_fields,
    template_id: endpointRecord.template_id,
    template_mode: endpointRecord.template_mode,
    masked_secret: maskEndpointSecret(endpointRecord.secret),
    previous_secret_expires_at: endpointRecord.previous_secret_expires_at,
    timeout_ms: endpointRecord.timeout_ms,
    retry_policy: endpointRecord.retry_policy,
    is_enabled: endpointRecord.is_enabled,
    query_params: endpointRecord.query_params,
    body_mode: endpointRecord.body_mode,
    body_fields: endpointRecord.body_fields,
    fields_encoding: endpointRecord.fields_encoding,
    raw_content_type: endpointRecord.raw_content_type,
    raw_body: endpointRecord.raw_body,
    render_mode: endpointRecord.render_mode,
    success_rate: calculateSuccessRate(recentDeliveries),
    delivery_count_24h: recentDeliveries.length,
    success_history: buildSuccessHistory(recentDeliveries, nowMs),
    created_by: endpointRecord.created_by,
    created_at: endpointRecord.created_at,
  };
}
