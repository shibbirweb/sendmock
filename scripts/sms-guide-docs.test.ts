import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const smsProvidersPage = readFileSync("docs/wiki/sms/providers.md", "utf8");

function readSection(pageText: string, heading: string): string {
  const sectionStart = pageText.indexOf(`## ${heading}\n`);
  const sectionEnd = pageText.indexOf("\n## ", sectionStart + 1);

  return sectionStart === -1 ? "" : pageText.slice(sectionStart, sectionEnd);
}

describe("SMS guide", () => {
  test("SM-19.7 the Twilio signatures section names each signing token, the default token, masking and how to reveal it", () => {
    const signaturesSection = readSection(
      smsProvidersPage,
      "Twilio signatures",
    );

    expect(signaturesSection).not.toBe("");
    expect(signaturesSection).toContain("Status callbacks");
    expect(signaturesSection).toContain("Inbound messages");
    expect(signaturesSection).toContain("twilio.status_callback");
    expect(signaturesSection).toContain("twilio_auth_token");
    expect(signaturesSection).toContain("`twilio-test-token`");
    expect(signaturesSection).toContain("masked");
    expect(signaturesSection).toContain(
      "sendmock sms providers credential twilio auth_token --reveal",
    );
    expect(signaturesSection).toContain(
      "sendmock sms twilio subaccounts token <accountSid> --reveal",
    );
  });
});
