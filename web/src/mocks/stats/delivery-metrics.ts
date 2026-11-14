import type {
  EndpointMetrics,
  FailureCodeCount,
  WebhookDelivery,
} from "@/lib/api/types";

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

export function countTopFailureCodes(
  deliveries: WebhookDelivery[],
  codeLimit: number,
): FailureCodeCount[] {
  const failureCounts = new Map<string, number>();
  for (const webhookDelivery of deliveries.filter(isFailedDelivery)) {
    const failureCode = readFailureCode(webhookDelivery);
    failureCounts.set(failureCode, (failureCounts.get(failureCode) ?? 0) + 1);
  }

  return [...failureCounts.entries()]
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, codeLimit)
    .map(([failureCode, failureCount]) => ({
      failure_code: failureCode,
      failure_count: failureCount,
    }));
}

const endpointFailureCodeLimit = 3;

/** Health of each endpoint over the given deliveries (WH-11.1). */
export function summarizeEndpointMetrics(
  webhookEndpoints: { id: string; name: string }[],
  deliveries: WebhookDelivery[],
): EndpointMetrics[] {
  return webhookEndpoints.map((webhookEndpoint) => {
    const endpointDeliveries = deliveries.filter(
      (webhookDelivery) => webhookDelivery.endpoint_id === webhookEndpoint.id,
    );
    const sortedDurations = sortDurations(endpointDeliveries);

    return {
      endpoint_id: webhookEndpoint.id,
      endpoint_name: webhookEndpoint.name,
      delivery_count: endpointDeliveries.length,
      success_rate: calculateSuccessRate(endpointDeliveries),
      p50_latency_ms: percentile(sortedDurations, 50),
      p95_latency_ms: percentile(sortedDurations, 95),
      retry_count: endpointDeliveries.filter(
        (webhookDelivery) => webhookDelivery.attempt > 1,
      ).length,
      top_failure_codes: countTopFailureCodes(
        endpointDeliveries,
        endpointFailureCodeLimit,
      ),
    };
  });
}
