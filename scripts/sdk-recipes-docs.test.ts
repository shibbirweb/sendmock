import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const recipe = readFileSync(
  "docs/wiki/recipes/sdks-without-a-base-url.md",
  "utf8",
);
const recipeIndex = readFileSync("docs/wiki/recipes/index.md", "utf8");
const recipeMenu = readFileSync("docs/wiki/recipes/meta.json", "utf8");

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
  test("AI-08.3 the recipe covers the Twilio PHP, Node and Python and Mailgun PHP and Node SDKs as CI runs them", () => {
    for (const [heading, examplePath, clientMarker] of sdkSections) {
      const sectionStart = recipe.indexOf(heading);
      expect(sectionStart).toBeGreaterThan(-1);
      const sectionText = recipe.slice(
        sectionStart,
        recipe.indexOf("\n## ", sectionStart + 1),
      );
      expect(sectionText).toContain(clientMarker);
      expect(readFileSync(examplePath, "utf8")).toContain(clientMarker);
    }
    expect(recipeIndex).toContain("./sdks-without-a-base-url.md");
    expect(recipeMenu).toContain('"sdks-without-a-base-url"');
  });
});
