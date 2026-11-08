import { describe, expect, test } from "vitest";

import { buildCatchPortUrl, buildCatchUrl } from "@/lib/http/build-catch-url";

describe("catch URLs", () => {
  test("a bin's catch URL is under /catch/ on the HTTP address", () => {
    expect(buildCatchUrl("0.0.0.0:8025", "orders")).toBe(
      "http://127.0.0.1:8025/catch/orders",
    );
  });

  test("HC-01.4 on the catch-all port the bin is the first path segment", () => {
    expect(buildCatchPortUrl("127.0.0.1:8030", "orders")).toBe(
      "http://127.0.0.1:8030/orders",
    );
    expect(buildCatchPortUrl("0.0.0.0:8030", "orders")).toBe(
      "http://127.0.0.1:8030/orders",
    );
  });

  test("HC-01.4 there is no port URL when the catch-all port is off", () => {
    expect(buildCatchPortUrl(null, "orders")).toBeNull();
  });
});
