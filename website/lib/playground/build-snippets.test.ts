import { describe, expect, test } from "bun:test";

import { buildSnippet, snippetLanguages } from "./build-snippets";

const postRequest = {
  method: "POST",
  url: "http://127.0.0.1:8025/api/v1/sms",
  headers: { "content-type": "application/json" },
  body: '{"to":"+8801700000000","body":"It\'s 482913"}',
};

describe("code snippets", () => {
  test("WS-04.2 every language carries the method, URL, content type and body", () => {
    expect(snippetLanguages).toHaveLength(9);
    for (const snippetLanguage of snippetLanguages) {
      const snippet = buildSnippet(snippetLanguage.key, postRequest);
      expect(snippet, snippetLanguage.label).toContain(
        "http://127.0.0.1:8025/api/v1/sms",
      );
      expect(snippet.toUpperCase(), snippetLanguage.label).toContain("POST");
      // C# sets the content type on StringContent, as .NET requires.
      expect(snippet, snippetLanguage.label).toContain("application/json");
      expect(snippet, snippetLanguage.label).toContain("482913");
    }
  });

  test("WS-04.2 a request without a body sends none", () => {
    const getRequest = {
      method: "GET",
      url: "http://127.0.0.1:8025/api/v1/health",
      headers: {},
      body: null,
    };

    expect(buildSnippet("curl", getRequest)).toBe(
      "curl -X GET 'http://127.0.0.1:8025/api/v1/health'",
    );
    expect(buildSnippet("python", getRequest)).not.toContain("data=");
    expect(buildSnippet("go", getRequest)).toContain(", nil)");
  });

  test("cURL quotes single quotes in the body for the shell", () => {
    expect(buildSnippet("curl", postRequest)).toContain(`It'\\''s 482913`);
  });

  test("Ruby uses the Net::HTTP class for the method", () => {
    expect(buildSnippet("ruby", postRequest)).toContain(
      "Net::HTTP::Post.new(uri)",
    );
  });
});
