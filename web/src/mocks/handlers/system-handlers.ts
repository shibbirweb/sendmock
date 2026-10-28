import { http, HttpResponse } from "msw";

import type { AppInfo, HealthStatus } from "@/lib/api/types";
import { readMockConditions } from "@/mocks/conditions/mock-conditions";
import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";
import { calculateAppStats } from "@/mocks/stats/calculate-app-stats";
import { findMockInstallProfile } from "@/mocks/updates/mock-releases";

/** What `/info` reports; Docker binds every interface instead of loopback. */
function buildMockAppInfo(): AppInfo {
  const mockConditions = readMockConditions();
  const isRunningInContainer = mockConditions.isRunningInContainer;
  const listenHost = isRunningInContainer ? "0.0.0.0" : "127.0.0.1";
  const installProfile = findMockInstallProfile(
    mockConditions.installProfileKey,
  );

  return {
    version: installProfile.version,
    channel: installProfile.releaseChannel,
    uptime_seconds: 0,
    smtp_address: `${listenHost}:1025`,
    http_address: `${listenHost}:8025`,
    provider_address: null,
    database_path: "(in-browser demo data)",
    database_size_bytes: 0,
    is_container: isRunningInContainer,
  };
}

export const systemHandlers = [
  http.get("*/api/v1/health", () =>
    HttpResponse.json({ status: "ok" } satisfies HealthStatus),
  ),

  http.get("*/api/v1/stats", async () => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(calculateAppStats(mockDatabase, Date.now()))
    );
  }),

  http.get("*/api/v1/info", async () => {
    await applyMockConditions();

    return HttpResponse.json(buildMockAppInfo());
  }),
];
