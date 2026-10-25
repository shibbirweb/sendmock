import { http, HttpResponse } from "msw";

import type { AppInfo } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { calculateAppStats } from "@/mocks/stats/calculate-app-stats";

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

    return conditionResponse ?? HttpResponse.json(calculateAppStats(mockDatabase, Date.now()));
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
