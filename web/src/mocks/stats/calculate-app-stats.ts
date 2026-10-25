import type {
  ActivityBucket,
  AppStats,
  EndpointMetrics,
  FailureCodeCount,
  RecentFailedDelivery,
  WebhookDelivery,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  calculateSuccessRate,
  isFailedDelivery,
  percentile,
  readFailureCode,
  sortDurations,
} from "@/mocks/stats/delivery-metrics";

const hourInMs = 60 * 60 * 1000;
const activityBucketCount = 24;
const topFailureCodeLimit = 3;
const recentFailureLimit = 5;

function readStartOfTodayMs(nowMs: number): number {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);

  return startOfToday.getTime();
}

function countSince(timestamps: string[], sinceMs: number): number {
  return timestamps.filter((timestamp) => Date.parse(timestamp) >= sinceMs)
    .length;
}

function countTopFailureCodes(
  deliveries: WebhookDelivery[],
): FailureCodeCount[] {
  const failureCounts = new Map<string, number>();
  for (const webhookDelivery of deliveries.filter(isFailedDelivery)) {
    const failureCode = readFailureCode(webhookDelivery);
    failureCounts.set(failureCode, (failureCounts.get(failureCode) ?? 0) + 1);
  }

  return [...failureCounts.entries()]
    .map(([failureCode, failureCount]) => ({ failureCode, failureCount }))
    .sort((first, second) => second.failureCount - first.failureCount)
    .slice(0, topFailureCodeLimit)
    .map(({ failureCode, failureCount }) => ({
      failure_code: failureCode,
      failure_count: failureCount,
    }));
}

/** 24 hourly buckets ending with the current hour (UI-03.3). */
export function buildActivityBuckets(
  mockDatabase: MockDatabase,
  nowMs: number,
): ActivityBucket[] {
  const currentHourStartMs = Math.floor(nowMs / hourInMs) * hourInMs;
  const firstBucketStartMs =
    currentHourStartMs - (activityBucketCount - 1) * hourInMs;
  const buckets = Array.from({ length: activityBucketCount }, (_, index) => ({
    bucket_start: new Date(firstBucketStartMs + index * hourInMs).toISOString(),
    email_count: 0,
    sms_count: 0,
    http_request_count: 0,
    webhook_delivery_count: 0,
  }));

  function addToBucket(
    timestamp: string,
    countKey: Exclude<keyof ActivityBucket, "bucket_start">,
  ) {
    const bucketIndex = Math.floor(
      (Date.parse(timestamp) - firstBucketStartMs) / hourInMs,
    );
    const bucket = buckets[bucketIndex];
    if (bucket !== undefined) {
      bucket[countKey] += 1;
    }
  }

  mockDatabase.emails.forEach((email) =>
    addToBucket(email.received_at, "email_count"),
  );
  mockDatabase.smsMessages.forEach((smsMessage) =>
    addToBucket(smsMessage.created_at, "sms_count"),
  );
  mockDatabase.capturedHttpRequests.forEach((capturedRequest) =>
    addToBucket(capturedRequest.created_at, "http_request_count"),
  );
  mockDatabase.webhookDeliveries.forEach((webhookDelivery) =>
    addToBucket(webhookDelivery.created_at, "webhook_delivery_count"),
  );

  return buckets;
}

/** Per endpoint health over the last 24 hours (UI-03.4). */
export function buildEndpointMetrics(
  mockDatabase: MockDatabase,
  nowMs: number,
): EndpointMetrics[] {
  const windowStartMs = nowMs - activityBucketCount * hourInMs;
  const recentDeliveries = mockDatabase.webhookDeliveries.filter(
    (webhookDelivery) =>
      Date.parse(webhookDelivery.created_at) >= windowStartMs,
  );

  return mockDatabase.webhookEndpoints.map((webhookEndpoint) => {
    const endpointDeliveries = recentDeliveries.filter(
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
      top_failure_codes: countTopFailureCodes(endpointDeliveries),
    };
  });
}

/** The newest failed deliveries, linking to the delivery (UI-03.5). */
export function buildRecentFailures(
  mockDatabase: MockDatabase,
): RecentFailedDelivery[] {
  return mockDatabase.webhookDeliveries
    .filter(isFailedDelivery)
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .slice(0, recentFailureLimit)
    .map((webhookDelivery) => ({
      delivery_id: webhookDelivery.id,
      endpoint_name: webhookDelivery.endpoint_name,
      event_type: webhookDelivery.event_type,
      status_code: webhookDelivery.response?.status_code ?? null,
      error_message: webhookDelivery.error_message,
      created_at: webhookDelivery.created_at,
    }));
}

/** Everything `GET /api/v1/stats` returns, computed from the mock DB. */
export function calculateAppStats(
  mockDatabase: MockDatabase,
  nowMs: number,
): AppStats {
  const startOfTodayMs = readStartOfTodayMs(nowMs);

  return {
    email_count: mockDatabase.emails.length,
    emails_today: countSince(
      mockDatabase.emails.map((email) => email.received_at),
      startOfTodayMs,
    ),
    unread_email_count: mockDatabase.emails.filter((email) => !email.is_read)
      .length,
    sms_count: mockDatabase.smsMessages.length,
    sms_today: countSince(
      mockDatabase.smsMessages.map((smsMessage) => smsMessage.created_at),
      startOfTodayMs,
    ),
    unread_sms_count: mockDatabase.smsMessages.filter(
      (smsMessage) => smsMessage.direction === "inbound",
    ).length,
    verification_count: mockDatabase.verifications.length,
    pending_verification_count: mockDatabase.verifications.filter(
      (verification) => verification.status === "pending",
    ).length,
    http_request_count: mockDatabase.capturedHttpRequests.length,
    http_requests_today: countSince(
      mockDatabase.capturedHttpRequests.map(
        (capturedRequest) => capturedRequest.created_at,
      ),
      startOfTodayMs,
    ),
    webhook_delivery_count: mockDatabase.webhookDeliveries.length,
    webhook_success_rate: calculateSuccessRate(mockDatabase.webhookDeliveries),
    webhook_p95_latency_ms: percentile(
      sortDurations(mockDatabase.webhookDeliveries),
      95,
    ),
    activity: buildActivityBuckets(mockDatabase, nowMs),
    endpoint_metrics: buildEndpointMetrics(mockDatabase, nowMs),
    recent_failures: buildRecentFailures(mockDatabase),
  };
}
