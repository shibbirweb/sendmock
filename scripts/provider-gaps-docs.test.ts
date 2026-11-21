import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const providerGapsPage = readFileSync("docs/wiki/http/provider-gaps.md", "utf8");
const skill = readFileSync("skill/sendmock/SKILL.md", "utf8");

describe("Provider gaps docs", () => {
  test("PL-21.6 the page walks through a worked Twilio example with a signed follow-up", () => {
    for (const step of [
      "1. Attach a bin to the Twilio provider:",
      "sendmock http provider-bin attach sms twilio --bin-name twilio-gaps",
      '"path_glob": "/2010-04-01/Accounts/*/Calls.json"',
      '"url": "{{ request.form.StatusCallback }}"',
      "X-Twilio-Signature",
      "[[http.provider_bins]]",
      "`fill-provider-gap`",
    ]) {
      expect(providerGapsPage).toContain(step);
    }
  });

  test("PL-21.6 the skill's section names the tools an agent needs", () => {
    expect(skill).toContain("### Fill a missing vendor endpoint");
    for (const toolName of [
      "sendmock_http_provider_bin_attach",
      "sendmock_http_response_set",
      "sendmock_http_response_preview",
      "sendmock_webhook_delivery_list",
    ]) {
      expect(skill).toContain(toolName);
    }
  });
});
