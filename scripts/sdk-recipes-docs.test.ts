import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const guidePage = readFileSync(
  "docs/wiki/connect/sdks-without-a-base-url.md",
  "utf8",
);
const connectIndex = readFileSync("docs/wiki/connect/index.md", "utf8");
const connectMenu = readFileSync("docs/wiki/connect/meta.json", "utf8");

/** Each recipe section, with the client class or option the CI example uses. */
const sdkSections = [
  [
    "## Twilio PHP",
    "examples/sms/php-twilio/send-and-verify.php",
    "extends CurlClient",
  ],
  [
    "## Twilio Node",
    "examples/sms/node-twilio/send-and-verify.js",
    "extends twilio.RequestClient",
  ],
  [
    "## Twilio Python",
    "examples/sms/python-twilio/send_and_verify.py",
    "(TwilioHttpClient)",
  ],
  [
    "## Mailgun PHP",
    "examples/email-providers/php-mailgun/send-and-verify.php",
    "Mailgun::create(",
  ],
  [
    "## Mailgun Node",
    "examples/email-providers/node/done-when.js",
    "new Mailgun(FormData).client(",
  ],
] as const;

describe("SDKs without a base URL setting (AI-08.3)", () => {
  test("AI-08.3 the guide page covers the Twilio PHP, Node and Python and Mailgun PHP and Node SDKs as CI runs them", () => {
    for (const [heading, examplePath, clientMarker] of sdkSections) {
      const sectionStart = guidePage.indexOf(heading);
      expect(sectionStart).toBeGreaterThan(-1);
      const sectionText = guidePage.slice(
        sectionStart,
        guidePage.indexOf("\n## ", sectionStart + 1),
      );
      expect(sectionText).toContain(clientMarker);
      expect(readFileSync(examplePath, "utf8")).toContain(clientMarker);
    }
    expect(connectIndex).toContain("./sdks-without-a-base-url.md");
    expect(connectMenu).toContain('"sdks-without-a-base-url"');
  });
});
