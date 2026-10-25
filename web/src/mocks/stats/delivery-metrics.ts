import type { WebhookDelivery } from "@/lib/api/types";

const finishedDeliveryStatuses: WebhookDelivery["status"][] = [
  "succeeded",
  "failed",
  "exhausted",
];
const failedDeliveryStatuses: WebhookDelivery["status"][] = [
  "failed",
  "exhausted",
  "render_failed",
];

export function percentile(
  sortedValues: number[],
  percentileRank: number,
): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  const valueIndex = Math.min(
    sortedValues.length - 1,
    Math.ceil((percentileRank / 100) * sortedValues.length) - 1,
  );

  return sortedValues[valueIndex] ?? null;
}

export function calculateSuccessRate(
  deliveries: WebhookDelivery[],
): number | null {
  const finishedDeliveries = deliveries.filter((webhookDelivery) =>
    finishedDeliveryStatuses.includes(webhookDelivery.status),
  );
  if (finishedDeliveries.length === 0) {
    return null;
  }

  const succeededCount = finishedDeliveries.filter(
    (webhookDelivery) => webhookDelivery.status === "succeeded",
  ).length;

  return succeededCount / finishedDeliveries.length;
}

export function sortDurations(deliveries: WebhookDelivery[]): number[] {
  return deliveries
    .map((webhookDelivery) => webhookDelivery.duration_ms)
    .filter((durationMs): durationMs is number => durationMs !== null)
    .sort((firstDuration, secondDuration) => firstDuration - secondDuration);
}

export function isFailedDelivery(webhookDelivery: WebhookDelivery): boolean {
  return failedDeliveryStatuses.includes(webhookDelivery.status);
}

/** "500", "render_failed" or "no_response" for a delivery that failed. */
export function readFailureCode(webhookDelivery: WebhookDelivery): string {
  if (webhookDelivery.status === "render_failed") {
    return "render_failed";
  }

  return webhookDelivery.response === null
    ? "no_response"
    : String(webhookDelivery.response.status_code);
}
