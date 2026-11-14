import type {
  DeliveryOutcomeBucket,
  RecentFailedDelivery,
  WebhookDelivery,
  WebhookMetrics,
  WebhookMetricsQuery,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  calculateSuccessRate,
  countTopFailureCodes,
  isFailedDelivery,
  percentile,
  sortDurations,
  summarizeEndpointMetrics,
} from "@/mocks/stats/delivery-metrics";

const hourInMs = 60 * 60 * 1000;
const dayInMs = 24 * hourInMs;
const topFailureCodeLimit = 6;
const recentFailureLimit = 8;

type DeliveryOutcome = "succeeded" | "retrying" | "failed";

/** Which stack a delivery goes in; a failed attempt with a retry ahead is retrying. */
export function readDeliveryOutcome(
  webhookDelivery: WebhookDelivery,
): DeliveryOutcome {
  if (webhookDelivery.status === "succeeded") {
    return "succeeded";
  }
  const isWaitingForRetry =
    webhookDelivery.status === "failed" &&
    webhookDelivery.next_attempt_at !== null;
  if (
    isWaitingForRetry ||
    webhookDelivery.status === "pending" ||
    webhookDelivery.status === "in_flight"
  ) {
    return "retrying";
  }

  return "failed";
}

/** 24 hours ending with the current hour, or 7 local days ending today. */
function readBucketStarts(
  range: WebhookMetricsQuery["range"],
  nowMs: number,
): number[] {
  if (range === "24h") {
    const currentHourMs = Math.floor(nowMs / hourInMs) * hourInMs;
    return Array.from(
      { length: 24 },
      (_, index) => currentHourMs - (23 - index) * hourInMs,
    );
  }

  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - (6 - index));
    return dayStart.getTime();
  });
}

function buildOutcomeBucket(
  bucketStartMs: number,
  bucketDeliveries: WebhookDelivery[],
): DeliveryOutcomeBucket {
  const countOutcome = (deliveryOutcome: DeliveryOutcome) =>
    bucketDeliveries.filter(
      (webhookDelivery) =>
        readDeliveryOutcome(webhookDelivery) === deliveryOutcome,
    ).length;
  const sortedDurations = sortDurations(bucketDeliveries);

  return {
    bucket_start: new Date(bucketStartMs).toISOString(),
    succeeded_count: countOutcome("succeeded"),
    retrying_count: countOutcome("retrying"),
    failed_count: countOutcome("failed"),
    p50_latency_ms: percentile(sortedDurations, 50),
    p95_latency_ms: percentile(sortedDurations, 95),
  };
}

function toRecentFailure(
  webhookDelivery: WebhookDelivery,
): RecentFailedDelivery {
  return {
    delivery_id: webhookDelivery.id,
    endpoint_name: webhookDelivery.endpoint_name,
    event_type: webhookDelivery.event_type,
    status_code: webhookDelivery.response?.status_code ?? null,
    error_message: webhookDelivery.error_message,
    created_at: webhookDelivery.created_at,
  };
}

/** Everything `GET /api/v1/webhooks/metrics` returns, from the delivery log (WH-11.3). */
export function calculateWebhookMetrics(
  mockDatabase: MockDatabase,
  metricsQuery: WebhookMetricsQuery,
  nowMs: number,
): WebhookMetrics {
  const bucketStarts = readBucketStarts(metricsQuery.range, nowMs);
  const windowStartMs = bucketStarts[0] ?? nowMs;
  const endpointId = metricsQuery.endpoint_id ?? null;
  const rangeDeliveries = mockDatabase.webhookDeliveries.filter(
    (webhookDelivery) =>
      Date.parse(webhookDelivery.created_at) >= windowStartMs &&
      (endpointId === null || webhookDelivery.endpoint_id === endpointId),
  );
  const sortedDurations = sortDurations(rangeDeliveries);

  return {
    range: metricsQuery.range,
    endpoint_id: endpointId,
    delivery_count: rangeDeliveries.length,
    success_rate: calculateSuccessRate(rangeDeliveries),
    p50_latency_ms: percentile(sortedDurations, 50),
    p95_latency_ms: percentile(sortedDurations, 95),
    retry_count: rangeDeliveries.filter(
      (webhookDelivery) => webhookDelivery.attempt > 1,
    ).length,
    render_failed_count: rangeDeliveries.filter(
      (webhookDelivery) => webhookDelivery.status === "render_failed",
    ).length,
    buckets: bucketStarts.map((bucketStartMs, bucketIndex) => {
      const bucketEndMs =
        bucketStarts[bucketIndex + 1] ??
        bucketStartMs + (metricsQuery.range === "24h" ? hourInMs : dayInMs);
      return buildOutcomeBucket(
        bucketStartMs,
        rangeDeliveries.filter((webhookDelivery) => {
          const createdAtMs = Date.parse(webhookDelivery.created_at);
          return createdAtMs >= bucketStartMs && createdAtMs < bucketEndMs;
        }),
      );
    }),
    endpoint_metrics: summarizeEndpointMetrics(
      mockDatabase.webhookEndpoints.filter(
        (webhookEndpoint) =>
          endpointId === null || webhookEndpoint.id === endpointId,
      ),
      rangeDeliveries,
    ),
    top_failure_codes: countTopFailureCodes(
      rangeDeliveries,
      topFailureCodeLimit,
    ),
    recent_failures: rangeDeliveries
      .filter(isFailedDelivery)
      .sort((first, second) =>
        second.created_at.localeCompare(first.created_at),
      )
      .slice(0, recentFailureLimit)
      .map(toRecentFailure),
  };
}
