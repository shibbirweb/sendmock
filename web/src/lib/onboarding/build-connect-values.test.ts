import { describe, expect, test } from "vitest";

import type { AppInfo } from "@/lib/api/types";
import {
  buildConnectValues,
  readConnectTarget,
} from "@/lib/onboarding/build-connect-values";

const localAppInfo: AppInfo = {
  version: "0.1.0",
  channel: "beta",
  uptime_seconds: 10,
  smtp_address: "127.0.0.1:2525",
  http_address: "127.0.0.1:9025",
  provider_address: null,
  database_path: "sendmock.db",
  database_size_bytes: 0,
  is_container: false,
  available_operations: [],
};

describe("buildConnectValues", () => {
  test("UI-04.1 uses this instance's ports from /info", () => {
    const connectTarget = readConnectTarget(localAppInfo, "this-machine");

    expect(buildConnectValues("smtp", connectTarget)).toEqual([
      { label: "SMTP host", connectValue: "127.0.0.1" },
      { label: "SMTP port", connectValue: "2525" },
    ]);
    expect(buildConnectValues("api", connectTarget)).toEqual([
      { label: "API base URL", connectValue: "http://127.0.0.1:9025/api/v1" },
    ]);
  });

  test("UI-04.1 uses container hostnames for apps in Docker", () => {
    const composeTarget = readConnectTarget(localAppInfo, "compose");
    const dockerHostTarget = readConnectTarget(localAppInfo, "docker-host");

    expect(buildConnectValues("overview", composeTarget)[0]).toEqual({
      label: "SMTP address",
      connectValue: "sendmock:2525",
    });
    expect(buildConnectValues("api", dockerHostTarget)[0]?.connectValue).toBe(
      "http://host.docker.internal:9025/api/v1",
    );
  });

  test("UI-04.1 points provider SDKs at the provider port when it is on", () => {
    const providerTarget = readConnectTarget(
      { ...localAppInfo, provider_address: "127.0.0.1:8026" },
      "this-machine",
    );
    const pathTarget = readConnectTarget(localAppInfo, "this-machine");

    expect(buildConnectValues("verify", providerTarget)[0]?.connectValue).toBe(
      "http://127.0.0.1:8026",
    );
    expect(buildConnectValues("sms", pathTarget)[2]?.connectValue).toBe(
      "http://127.0.0.1:9025/providers/vonage",
    );
  });

  test("falls back to the default ports before /info has loaded", () => {
    const connectTarget = readConnectTarget(undefined, "this-machine");

    expect(buildConnectValues("overview", connectTarget)).toEqual([
      { label: "SMTP address", connectValue: "127.0.0.1:1025" },
      { label: "API base URL", connectValue: "http://127.0.0.1:8025/api/v1" },
    ]);
  });
});
