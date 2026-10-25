import { http, HttpResponse } from "msw";

import type { AppInfo, AppStats } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  paginateItems,
} from "@/mocks/handlers/handler-utils";

function percentile(
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

function calculateStats(): AppStats {
  const finishedDeliveries = mockDatabase.webhookDeliveries.filter(
    (webhookDelivery) =>
      webhookDelivery.status === "succeeded" ||
      webhookDelivery.status === "failed" ||
      webhookDelivery.status === "exhausted",
  );
  const succeededDeliveryCount = finishedDeliveries.filter(
    (webhookDelivery) => webhookDelivery.status === "succeeded",
  ).length;
  const sortedDurations = mockDatabase.webhookDeliveries
    .map((webhookDelivery) => webhookDelivery.duration_ms)
    .filter((durationMs): durationMs is number => durationMs !== null)
    .sort((firstDuration, secondDuration) => firstDuration - secondDuration);

  return {
    email_count: mockDatabase.emails.length,
    unread_email_count: mockDatabase.emails.filter((email) => !email.is_read)
      .length,
    sms_count: mockDatabase.smsMessages.length,
    unread_sms_count: mockDatabase.smsMessages.filter(
      (smsMessage) => smsMessage.direction === "inbound",
    ).length,
    verification_count: mockDatabase.verifications.length,
    http_request_count: mockDatabase.capturedHttpRequests.length,
    webhook_delivery_count: mockDatabase.webhookDeliveries.length,
    webhook_success_rate:
      finishedDeliveries.length === 0
        ? null
        : succeededDeliveryCount / finishedDeliveries.length,
    webhook_p95_latency_ms: percentile(sortedDurations, 95),
    recent_failed_delivery_ids: mockDatabase.webhookDeliveries
      .filter((webhookDelivery) =>
        ["failed", "exhausted", "render_failed"].includes(
          webhookDelivery.status,
        ),
      )
      .slice(0, 5)
      .map((webhookDelivery) => webhookDelivery.id),
  };
}

const mockAppInfo: AppInfo = {
  version: "0.0.0-dev",
  channel: "dev",
  uptime_seconds: 0,
  smtp_address: "127.0.0.1:1025",
  http_address: "127.0.0.1:8025",
  provider_address: null,
  database_path: "(in-browser demo data)",
  database_size_bytes: 0,
};

export const systemHandlers = [
  http.get("*/api/v1/health", () => HttpResponse.json({ status: "ok" })),

  http.get("*/api/v1/stats", async () => {
    const conditionResponse = await applyMockConditions();

    return conditionResponse ?? HttpResponse.json(calculateStats());
  }),

  http.get("*/api/v1/info", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockAppInfo);
  }),

  http.get("*/api/v1/http/bins", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.httpBins);
  }),

  http.get("*/api/v1/http/requests", async ({ request }) => {
    await applyMockConditions();
    const requestUrl = new URL(request.url);
    const binFilter = requestUrl.searchParams.get("bin_id");
    const matchingRequests = mockDatabase.capturedHttpRequests.filter(
      (capturedRequest) => !binFilter || capturedRequest.bin_id === binFilter,
    );

    return HttpResponse.json(paginateItems(matchingRequests, requestUrl));
  }),
];
