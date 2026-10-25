import { http, HttpResponse } from "msw";

import type { WebhookMetricsRange } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";
import { calculateWebhookMetrics } from "@/mocks/stats/calculate-webhook-metrics";

export const webhookMetricsHandlers = [
  http.get("*/api/v1/webhooks/metrics", async ({ request }) => {
    await applyMockConditions();
    const searchParams = new URL(request.url).searchParams;
    const range: WebhookMetricsRange =
      searchParams.get("range") === "7d" ? "7d" : "24h";
    const endpointId = searchParams.get("endpoint_id");

    return HttpResponse.json(
      calculateWebhookMetrics(
        mockDatabase,
        { range, ...(endpointId === null ? {} : { endpoint_id: endpointId }) },
        Date.now(),
      ),
    );
  }),
];
