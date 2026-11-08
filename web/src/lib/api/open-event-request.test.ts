import { afterEach, describe, expect, test, vi } from "vitest";

import { buildOpenEventRequest } from "@/lib/api/open-event-request";

describe("buildOpenEventRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends the source with the browser's user agent", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Test)" });

    expect(buildOpenEventRequest("ui")).toEqual({
      source: "ui",
      user_agent: "Mozilla/5.0 (Test)",
    });
  });

  test("leaves the user agent out when there is none", () => {
    vi.stubGlobal("navigator", { userAgent: "" });

    expect(buildOpenEventRequest("manual")).toEqual({ source: "manual" });
  });
});
