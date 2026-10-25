import { describe, expect, test } from "vitest";

import { buildTestResponseRule } from "@/lib/http/test-captured-request";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { captureHttpRequest } from "@/mocks/http/capture-http-request";
import { routeDeliveryToCatcher } from "@/mocks/http/route-delivery-to-catcher";
import { buildTestDelivery } from "@/mocks/webhooks/build-test-delivery";

function captureJson(
  mockDatabase: ReturnType<typeof createMockDatabase>,
  url: string,
  body: string,
) {
  return captureHttpRequest(mockDatabase, {
    method: "POST",
    url,
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("captureHttpRequest", () => {
  test("HC-01.1 records any path under /catch/<bin> and creates the bin on first use", () => {
    const mockDatabase = createMockDatabase("standard");

    const capturedRequest = captureJson(
      mockDatabase,
      "http://127.0.0.1:8025/catch/orders/v2/created?source=shop",
      '{"order":1}',
    );

    expect(capturedRequest).toMatchObject({
      bin_name: "orders",
      path: "/catch/orders/v2/created",
      query: { source: "shop" },
      response_status: 200,
      response_body: '{"ok":true}',
      matched_rule_name: null,
    });
    expect(
      mockDatabase.httpBins.find((httpBin) => httpBin.name === "orders"),
    ).toMatchObject({
      request_count: 1,
    });
    expect(mockDatabase.capturedHttpRequests[0]?.id).toBe(capturedRequest.id);
  });

  test("HC-02.2 a matching rule answers with its status and templated body", () => {
    const mockDatabase = createMockDatabase("standard");
    const analyticsBin = mockDatabase.httpBins.find(
      (httpBin) => httpBin.name === "analytics",
    );
    if (analyticsBin === undefined) {
      throw new Error("The fixtures need the analytics bin.");
    }
    mockDatabase.httpResponseRules.set(analyticsBin.id, [
      buildTestResponseRule({
        response: {
          status_code: 201,
          headers: {},
          body: '{"echo":"{{ request.json.event }}"}',
        },
      }),
    ]);

    expect(
      captureJson(
        mockDatabase,
        "http://127.0.0.1:8025/catch/analytics/track",
        '{"event":"signup"}',
      ),
    ).toMatchObject({
      response_status: 201,
      response_body: '{"echo":"signup"}',
      matched_rule_name: "Rate limited",
    });
  });

  test("HC-02.3 a failure rate of 100% answers with the failure status; the delay is recorded", () => {
    const mockDatabase = createMockDatabase("standard");
    const analyticsBin = mockDatabase.httpBins.find(
      (httpBin) => httpBin.name === "analytics",
    );
    if (analyticsBin === undefined) {
      throw new Error("The fixtures need the analytics bin.");
    }
    mockDatabase.httpResponseRules.set(analyticsBin.id, [
      buildTestResponseRule({
        failure_rate_percent: 100,
        failure_status_code: 503,
        delay_min_ms: 800,
        delay_max_ms: 800,
      }),
    ]);

    const capturedRequest = captureJson(
      mockDatabase,
      "http://127.0.0.1:8025/catch/analytics/track",
      "{}",
    );

    expect(capturedRequest).toMatchObject({
      response_status: 503,
      is_simulated_failure: true,
      duration_ms: 801,
    });
  });
});

describe("routeDeliveryToCatcher", () => {
  test("HC-01.1 a webhook sent to /catch/... lands in the catcher and records its reply", () => {
    const mockDatabase = createMockDatabase("standard");
    const [endpointRecord] = mockDatabase.webhookEndpoints;
    if (endpointRecord === undefined) {
      throw new Error("The fixtures need an endpoint.");
    }
    const catcherDelivery = routeDeliveryToCatcher(
      mockDatabase,
      buildTestDelivery({
        ...endpointRecord,
        url: "http://127.0.0.1:8025/catch/webhooks",
      }),
    );

    expect(catcherDelivery).toMatchObject({
      status: "succeeded",
      response: { status_code: 200, body: '{"ok":true}' },
    });
    expect(mockDatabase.capturedHttpRequests[0]).toMatchObject({
      bin_name: "webhooks",
      method: "POST",
    });
  });
});
