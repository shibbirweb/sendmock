import { describe, expect, test } from "vitest";

import type { WebhookDelivery } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  calculateWebhookMetrics,
  readDeliveryOutcome,
} from "@/mocks/stats/calculate-webhook-metrics";

const fixedNowMs = Date.parse("2026-10-25T12:30:00.000Z");
const hourInMs = 60 * 60 * 1000;

function hoursBeforeNow(hours: number): string {
  return new Date(fixedNowMs - hours * hourInMs).toISOString();
}

function buildDatabase(deliveryOverrides: Partial<WebhookDelivery>[]) {
  const templateDelivery = createMockDatabase("standard").webhookDeliveries[0];
  const mockDatabase = createMockDatabase("empty");
  const [firstEndpoint, secondEndpoint] = mockDatabase.webhookEndpoints;
  if (
    templateDelivery === undefined ||
    firstEndpoint === undefined ||
    secondEndpoint === undefined
  ) {
    throw new Error("The fixtures need a delivery and two endpoints.");
  }
  mockDatabase.webhookDeliveries = deliveryOverrides.map(
    (deliveryOverride, deliveryIndex) => ({
      ...templateDelivery,
      id: `delivery-${deliveryIndex}`,
      endpoint_id: firstEndpoint.id,
      endpoint_name: firstEndpoint.name,
      status: "succeeded",
      attempt: 1,
      duration_ms: 100,
      next_attempt_at: null,
      response: null,
      created_at: hoursBeforeNow(1),
      ...deliveryOverride,
    }),
  );

  return { mockDatabase, firstEndpoint, secondEndpoint };
}

describe("readDeliveryOutcome", () => {
  test("WH-11.3 a failed attempt with a retry ahead is retrying, else failed", () => {
    const { mockDatabase } = buildDatabase([{}]);
    const [baseDelivery] = mockDatabase.webhookDeliveries;
    if (baseDelivery === undefined) {
      throw new Error("Expected a delivery.");
    }

    expect(readDeliveryOutcome(baseDelivery)).toBe("succeeded");
    expect(
      readDeliveryOutcome({
        ...baseDelivery,
        status: "failed",
        next_attempt_at: hoursBeforeNow(-1),
      }),
    ).toBe("retrying");
    expect(readDeliveryOutcome({ ...baseDelivery, status: "pending" })).toBe(
      "retrying",
    );
    expect(readDeliveryOutcome({ ...baseDelivery, status: "failed" })).toBe(
      "failed",
    );
    expect(readDeliveryOutcome({ ...baseDelivery, status: "exhausted" })).toBe(
      "failed",
    );
  });
});

describe("calculateWebhookMetrics", () => {
  test("WH-11.3 24 hours gives hourly buckets of outcomes with latency", () => {
    const { mockDatabase } = buildDatabase([
      { created_at: hoursBeforeNow(0.1), duration_ms: 100 },
      { created_at: hoursBeforeNow(0.2), duration_ms: 300 },
      { created_at: hoursBeforeNow(0.3), status: "exhausted", attempt: 3 },
      { created_at: hoursBeforeNow(30) },
    ]);

    const webhookMetrics = calculateWebhookMetrics(
      mockDatabase,
      { range: "24h" },
      fixedNowMs,
    );

    expect(webhookMetrics.buckets).toHaveLength(24);
    expect(webhookMetrics.buckets.at(-1)).toMatchObject({
      succeeded_count: 2,
      failed_count: 1,
      retrying_count: 0,
      p50_latency_ms: 100,
      p95_latency_ms: 300,
    });
    expect(webhookMetrics).toMatchObject({
      delivery_count: 3,
      retry_count: 1,
      success_rate: 2 / 3,
    });
  });

  test("WH-11.3 7 days gives daily buckets and counts older deliveries", () => {
    const { mockDatabase } = buildDatabase([
      { created_at: hoursBeforeNow(1) },
      { created_at: hoursBeforeNow(50) },
      { created_at: hoursBeforeNow(200) },
    ]);

    const webhookMetrics = calculateWebhookMetrics(
      mockDatabase,
      { range: "7d" },
      fixedNowMs,
    );

    expect(webhookMetrics.buckets).toHaveLength(7);
    expect(webhookMetrics.delivery_count).toBe(2);
  });

  test("WH-11.1 one endpoint narrows totals, per-endpoint rows and failure codes", () => {
    const { mockDatabase, secondEndpoint } = buildDatabase([
      { status: "render_failed" },
      {
        endpoint_id: "other",
        status: "exhausted",
        response: {
          status_code: 503,
          headers: {},
          body: "",
          is_body_truncated: false,
        },
      },
    ]);
    mockDatabase.webhookDeliveries[1] = {
      ...(mockDatabase.webhookDeliveries[1] as WebhookDelivery),
      endpoint_id: secondEndpoint.id,
    };

    const webhookMetrics = calculateWebhookMetrics(
      mockDatabase,
      { range: "24h", endpoint_id: secondEndpoint.id },
      fixedNowMs,
    );

    expect(webhookMetrics.delivery_count).toBe(1);
    expect(webhookMetrics.render_failed_count).toBe(0);
    expect(webhookMetrics.endpoint_metrics).toHaveLength(1);
    expect(webhookMetrics.top_failure_codes).toEqual([
      { failure_code: "503", failure_count: 1 },
    ]);
    expect(webhookMetrics.recent_failures).toHaveLength(1);
  });
});
