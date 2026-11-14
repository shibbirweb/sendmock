import type {
  ActivityBucket,
  AppStats,
  EndpointMetrics,
  RecentFailedDelivery,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  calculateSuccessRate,
  isFailedDelivery,
  percentile,
  sortDurations,
  summarizeEndpointMetrics,
} from "@/mocks/stats/delivery-metrics";
import { calculatePaymentStats } from "@/mocks/stats/payment-stats";

const hourInMs = 60 * 60 * 1000;
const activityBucketCount = 24;
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

  return summarizeEndpointMetrics(
    mockDatabase.webhookEndpoints,
    recentDeliveries,
  );
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
    ...calculatePaymentStats(mockDatabase.payments, startOfTodayMs),
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
