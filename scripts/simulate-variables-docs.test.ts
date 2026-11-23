import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const outcomesPage = readFileSync("docs/wiki/mail/outcomes.md", "utf8");

describe("Simulating with the app's own ids", () => {
  test("EM-27.3 the guide tests opens and bounces of SMTP mail with user variables, without editing payloads", () => {
    for (const expectedText of [
      "## Test opens and bounces with your app's own ids",
      "1. Send the email from your app over SMTP, as it does in production.",
      "sendmock email simulate <emailId> bounced --user-variables",
      "sendmock email open <emailId> --user-variables",
      "No payload editing needed.",
      "**Count as an open**",
    ]) {
      expect(outcomesPage).toContain(expectedText);
    }
  });
});
