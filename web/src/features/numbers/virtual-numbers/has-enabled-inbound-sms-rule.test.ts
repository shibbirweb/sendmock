import { describe, expect, test } from "vitest";

import { hasEnabledInboundSmsRule } from "@/features/numbers/virtual-numbers/has-enabled-inbound-sms-rule";

describe("hasEnabledInboundSmsRule", () => {
  test("is true when an enabled rule listens to sms.inbound", () => {
    expect(
      hasEnabledInboundSmsRule([
        { is_enabled: true, events: ["email.received"] },
        { is_enabled: true, events: ["sms.sent", "sms.inbound"] },
      ]),
    ).toBe(true);
  });

  test("ignores disabled rules and rules for other events", () => {
    expect(
      hasEnabledInboundSmsRule([
        { is_enabled: false, events: ["sms.inbound"] },
        { is_enabled: true, events: ["sms.status"] },
      ]),
    ).toBe(false);
  });
});
