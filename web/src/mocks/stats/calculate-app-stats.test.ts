import { describe, expect, test } from "vitest";

import type { WebhookDelivery } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  buildActivityBuckets,
  buildEndpointMetrics,
  buildRecentFailures,
  calculateAppStats,
} from "@/mocks/stats/calculate-app-stats";

const fixedNowMs = Date.parse("2026-10-25T12:30:00.000Z");
const hourInMs = 60 * 60 * 1000;

function hoursBeforeNow(hours: number): string {
  return new Date(fixedNowMs - hours * hourInMs).toISOString();
}

function buildDatabaseWithDeliveries(
  deliveryOverrides: Partial<WebhookDelivery>[],
) {
  const templateDelivery = createMockDatabase("standard").webhookDeliveries[0];
  const emptyDatabase = createMockDatabase("empty");
  const firstEndpoint = emptyDatabase.webhookEndpoints[0];
  if (templateDelivery === undefined || firstEndpoint === undefined) {
    throw new Error("The fixtures need at least one delivery and endpoint.");
  }

  emptyDatabase.webhookDeliveries = deliveryOverrides.map(
    (deliveryOverride, index) => ({
      ...templateDelivery,
      id: `delivery-${index}`,
      endpoint_id: firstEndpoint.id,
      endpoint_name: firstEndpoint.name,
      attempt: 1,
      created_at: hoursBeforeNow(1),
      ...deliveryOverride,
    }),
  );

  return { mockDatabase: emptyDatabase, firstEndpoint };
}

describe("calculateAppStats", () => {
  test("UI-03.3 builds 24 hourly buckets ending with the current hour", () => {
    const { mockDatabase } = buildDatabaseWithDeliveries([
      { created_at: hoursBeforeNow(0) },
      { created_at: hoursBeforeNow(0.1) },
      { created_at: hoursBeforeNow(5) },
      { created_at: hoursBeforeNow(30) },
    ]);

    const activityBuckets = buildActivityBuckets(mockDatabase, fixedNowMs);

    expect(activityBuckets).toHaveLength(24);
    expect(activityBuckets.at(-1)?.bucket_start).toBe(
      "2026-10-25T12:00:00.000Z",
    );
    expect(activityBuckets.at(-1)?.webhook_delivery_count).toBe(2);
    expect(activityBuckets.at(-6)?.webhook_delivery_count).toBe(1);
    expect(
      activityBuckets.reduce(
        (totalCount, bucket) => totalCount + bucket.webhook_delivery_count,
        0,
      ),
    ).toBe(3);
  });

  test("UI-03.4 summarises each endpoint's success, latency, retries and failure codes", () => {
    const { mockDatabase, firstEndpoint } = buildDatabaseWithDeliveries([
      { status: "succeeded", duration_ms: 100 },
      { status: "succeeded", duration_ms: 200, attempt: 2 },
      {
        status: "failed",
        duration_ms: 900,
        response: {
          status_code: 500,
          headers: {},
          body: "",
          is_body_truncated: false,
        },
      },
      { status: "exhausted", duration_ms: null, response: null },
      { status: "succeeded", duration_ms: 50, created_at: hoursBeforeNow(30) },
    ]);

    const endpointMetrics = buildEndpointMetrics(mockDatabase, fixedNowMs).find(
      (metrics) => metrics.endpoint_id === firstEndpoint.id,
    );

    expect(endpointMetrics).toMatchObject({
      delivery_count: 4,
      success_rate: 0.5,
      p50_latency_ms: 200,
      p95_latency_ms: 900,
      retry_count: 1,
    });
    expect(endpointMetrics?.top_failure_codes).toEqual([
      { failure_code: "500", failure_count: 1 },
      { failure_code: "no_response", failure_count: 1 },
    ]);
  });

  test("UI-03.4 reports no rate or latency for an endpoint without deliveries", () => {
    const { mockDatabase } = buildDatabaseWithDeliveries([]);

    const [endpointMetrics] = buildEndpointMetrics(mockDatabase, fixedNowMs);

    expect(endpointMetrics).toMatchObject({
      delivery_count: 0,
      success_rate: null,
      p50_latency_ms: null,
      p95_latency_ms: null,
      top_failure_codes: [],
    });
  });

  test("UI-03.1 lists the newest failed deliveries first", () => {
    const { mockDatabase } = buildDatabaseWithDeliveries([
      { status: "failed", created_at: hoursBeforeNow(3) },
      { status: "succeeded", created_at: hoursBeforeNow(1) },
      { status: "render_failed", created_at: hoursBeforeNow(2) },
    ]);

    const recentFailures = buildRecentFailures(mockDatabase);

    expect(recentFailures.map((failure) => failure.delivery_id)).toEqual([
      "delivery-2",
      "delivery-0",
    ]);
  });

  test("UI-03.1 counts pending verifications and today's traffic", () => {
    const mockDatabase = createMockDatabase("standard");

    const appStats = calculateAppStats(mockDatabase, Date.now());

    expect(appStats.pending_verification_count).toBe(
      mockDatabase.verifications.filter(
        (verification) => verification.status === "pending",
      ).length,
    );
    expect(appStats.emails_today).toBeLessThanOrEqual(appStats.email_count);
    expect(appStats.activity).toHaveLength(24);
  });
});
