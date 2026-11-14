import { describe, expect, test } from "vitest";

import { buildCurlCommand } from "@/lib/webhooks/build-curl-command";

describe("buildCurlCommand", () => {
  test("WH-03.8 copies method, URL, headers and body", () => {
    expect(
      buildCurlCommand({
        method: "POST",
        url: "http://localhost:8000/hooks",
        headers: { "content-type": "application/json", "webhook-id": "evt_1" },
        body: '{"ok":true}',
      }),
    ).toBe(
      [
        "curl -X POST 'http://localhost:8000/hooks' \\",
        "  -H 'content-type: application/json' \\",
        "  -H 'webhook-id: evt_1' \\",
        `  --data-raw '{"ok":true}'`,
      ].join("\n"),
    );
  });

  test("escapes single quotes and leaves out an empty body", () => {
    expect(
      buildCurlCommand({
        method: "GET",
        url: "http://localhost/it's",
        headers: {},
        body: "",
      }),
    ).toBe("curl -X GET 'http://localhost/it'\\''s'");
  });
});
