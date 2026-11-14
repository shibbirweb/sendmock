import { describe, expect, test } from "vitest";

import {
  appLocationHosts,
  buildConnectionSnippets,
  readPort,
  snippetLanguages,
} from "@/lib/settings/build-connection-snippets";

const localTarget = { host: "127.0.0.1", smtpPort: 1025, httpPort: 8025 };

describe("buildConnectionSnippets", () => {
  test("PL-05.5 every language gets SMTP, email, SMS and catcher snippets", () => {
    for (const language of snippetLanguages) {
      const connectionSnippets = buildConnectionSnippets(language, localTarget);

      expect(connectionSnippets.map((snippet) => snippet.area)).toEqual([
        "smtp",
        "email-api",
        "sms",
        "catcher",
      ]);
      for (const snippet of connectionSnippets) {
        expect(snippet.code).toContain("127.0.0.1");
      }
    }
  });

  test("PL-05.5 uses the host for where the app runs and the given ports", () => {
    const [smtpSnippet, , smsSnippet] = buildConnectionSnippets("laravel", {
      host: appLocationHosts.compose,
      smtpPort: 2525,
      httpPort: 9025,
    });

    expect(smtpSnippet?.code).toContain("MAIL_HOST=sendmock");
    expect(smtpSnippet?.code).toContain("MAIL_PORT=2525");
    expect(smsSnippet?.code).toContain(
      'Http::post("http://sendmock:9025/api/v1/sms"',
    );
    expect(smsSnippet?.code).toContain("'to' => '+8801700000000'");
  });

  test("cURL snippets post JSON to the native API", () => {
    const [, emailSnippet] = buildConnectionSnippets("curl", localTarget);

    expect(emailSnippet?.code).toContain(
      "curl -X POST http://127.0.0.1:8025/api/v1/send",
    );
  });
});

describe("readPort", () => {
  test("reads the port from a listen address, or falls back", () => {
    expect(readPort("127.0.0.1:1025", 25)).toBe(1025);
    expect(readPort(null, 8026)).toBe(8026);
  });
});
