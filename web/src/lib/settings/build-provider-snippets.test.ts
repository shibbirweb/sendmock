import { describe, expect, test } from "vitest";

import {
  buildMailgunSnippet,
  buildTwilioSnippet,
} from "@/lib/settings/build-provider-snippets";

const localTarget = {
  host: "127.0.0.1",
  providerPort: 8026,
  providerTlsPort: 8027,
};

describe("provider snippets", () => {
  test("AI-08.2 Laravel gets Mailgun over HTTPS with the trust step and Twilio with the recipe", () => {
    const mailgun = buildMailgunSnippet("laravel", localTarget);
    const twilio = buildTwilioSnippet("laravel", localTarget);

    expect(mailgun).toContain("MAILGUN_ENDPOINT=127.0.0.1:8027");
    expect(mailgun).toContain("sendmock trust");
    expect(mailgun).toContain("mailgun_signing_key");
    expect(twilio).toContain("CurlClient that sends to http://127.0.0.1:8026");
    expect(twilio).toContain("signed with the auth token");
  });

  test("curl gets a request to the provider port", () => {
    expect(buildMailgunSnippet("curl", localTarget)).toContain(
      "http://127.0.0.1:8026/v3/mg.example.test/messages",
    );
    expect(buildTwilioSnippet("curl", localTarget)).toContain(
      "http://127.0.0.1:8026/2010-04-01/Accounts/",
    );
  });
});
