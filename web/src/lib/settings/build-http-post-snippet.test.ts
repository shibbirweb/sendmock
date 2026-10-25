import { describe, expect, test } from "vitest";

import { snippetLanguages } from "@/lib/settings/build-connection-snippets";
import { buildHttpPostSnippet } from "@/lib/settings/build-http-post-snippet";
import { toPhpLiteral, toPythonLiteral } from "@/lib/settings/json-literals";

const customRequest = {
  requestUrl: "http://127.0.0.1:8025/api/v1/sms",
  requestHeaders: [
    { headerName: "Authorization", headerValue: "Bearer abc123" },
    { headerName: "Idempotency-Key", headerValue: "order-42" },
  ],
  requestBody: {
    from: "+15550001111",
    to: "+8801700000000",
    body: "Hi",
    status_callback: "http://localhost:8000/sms/status",
    metadata: { order_id: 42, is_test: true, note: null },
  },
};

describe("buildHttpPostSnippet", () => {
  test("PL-05.7 every language carries the custom headers and payload fields", () => {
    for (const language of snippetLanguages) {
      const postSnippet = buildHttpPostSnippet(language, customRequest);

      expect(postSnippet, language).toContain("Authorization");
      expect(postSnippet, language).toContain("Bearer abc123");
      expect(postSnippet, language).toContain("Idempotency-Key");
      expect(postSnippet, language).toContain("status_callback");
      expect(postSnippet, language).toContain("order_id");
    }
  });

  test("PL-05.7 headers use each language's own syntax", () => {
    expect(buildHttpPostSnippet("laravel", customRequest)).toContain(
      "Http::withHeaders([\n    'Authorization' => 'Bearer abc123',",
    );
    expect(buildHttpPostSnippet("python", customRequest)).toContain(
      'headers={\n        "Authorization": "Bearer abc123",',
    );
    expect(buildHttpPostSnippet("go", customRequest)).toContain(
      'request.Header.Set("Authorization", "Bearer abc123")',
    );
    expect(buildHttpPostSnippet("curl", customRequest)).toContain(
      '-H "Authorization: Bearer abc123"',
    );
    expect(buildHttpPostSnippet("dotnet", customRequest)).toContain(
      'request.Headers.Add("Authorization", "Bearer abc123");',
    );
  });

  test("without custom headers the snippets stay minimal", () => {
    const plainRequest = { ...customRequest, requestHeaders: [] };

    expect(buildHttpPostSnippet("laravel", plainRequest)).toMatch(
      /^Http::post\(/,
    );
    expect(buildHttpPostSnippet("python", plainRequest)).not.toContain(
      "headers=",
    );
  });

  test("cURL escapes single quotes in the body", () => {
    const curlSnippet = buildHttpPostSnippet("curl", {
      ...customRequest,
      requestBody: { body: "It's done" },
    });

    expect(curlSnippet).toContain(`-d '{"body":"It'\\''s done"}'`);
  });
});

describe("json literals", () => {
  test("Python uses True, False and None", () => {
    expect(toPythonLiteral({ is_test: true, is_live: false, note: null })).toBe(
      '{\n    "is_test": True,\n    "is_live": False,\n    "note": None,\n}',
    );
  });

  test("PHP nests arrays and escapes quotes", () => {
    expect(toPhpLiteral({ to: ["a@b.test"], meta: { name: "O'Brien" } })).toBe(
      "[\n    'to' => [\n        'a@b.test',\n    ],\n    'meta' => [\n        'name' => 'O\\'Brien',\n    ],\n]",
    );
  });
});
