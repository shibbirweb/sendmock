import { describe, expect, test } from "vitest";

import type { EmailOutcomeRule, SmsOutcomeRule } from "@/lib/api/types";
import { matchesOutcomePattern } from "@/lib/outcomes/match-outcome-pattern";
import {
  resolveEmailOutcome,
  resolveSmsOutcome,
} from "@/lib/outcomes/resolve-outcome";
import {
  validateEmailOutcomeRuleInput,
  validateSmsOutcomeRuleInput,
} from "@/lib/outcomes/validate-outcome-rules";

function buildSmsRule(ruleFields: Partial<SmsOutcomeRule>): SmsOutcomeRule {
  return {
    id: "rule-1",
    position: 1,
    match_field: "to",
    pattern: "+15559990000",
    outcome: "undelivered",
    error_code: "30007",
    delay_seconds: null,
    note: "",
    is_enabled: true,
    created_by: "ui",
    ...ruleFields,
  };
}

describe("matchesOutcomePattern", () => {
  test("SM-07.8 * matches any digits and whatsapp: prefixes are ignored", () => {
    expect(matchesOutcomePattern("+1555777*", "+15557771234")).toBe(true);
    expect(matchesOutcomePattern("+1555777*", "whatsapp:+15557770000")).toBe(
      true,
    );
    expect(matchesOutcomePattern("+1555777*", "+15558881234")).toBe(false);
    expect(matchesOutcomePattern("+15559990000", "+155599900001")).toBe(false);
  });

  test("email patterns ignore case", () => {
    expect(
      matchesOutcomePattern("*@bounce.qa.test", "Rahim@Bounce.QA.test"),
    ).toBe(true);
  });
});

describe("resolveSmsOutcome", () => {
  test("SM-07.8 the first enabled matching rule wins, before magic numbers", () => {
    const outcomeRules = [
      buildSmsRule({ id: "late", position: 2, pattern: "+15005550*" }),
      buildSmsRule({
        id: "disabled",
        position: 1,
        pattern: "+15005550*",
        is_enabled: false,
      }),
    ];

    expect(resolveSmsOutcome("+15005550001", "to", outcomeRules, true)).toEqual(
      {
        source: "custom",
        ruleId: "late",
        rulePosition: 2,
      },
    );
  });

  test("SM-07.9 magic numbers apply only while switched on", () => {
    expect(resolveSmsOutcome("+15005550001", "to", [], true)).toMatchObject({
      source: "magic",
      magicRow: { code: "21211" },
    });
    expect(resolveSmsOutcome("+15005550007", "from", [], true)).toMatchObject({
      magicRow: { code: "21606" },
    });
    expect(resolveSmsOutcome("+15005550001", "to", [], false)).toEqual({
      source: "profile",
    });
  });

  test("rules only apply to their own field", () => {
    expect(
      resolveSmsOutcome("+15559990000", "from", [buildSmsRule({})], true),
    ).toEqual({
      source: "profile",
    });
  });
});

describe("resolveEmailOutcome", () => {
  const bounceRule: EmailOutcomeRule = {
    id: "bounce-rule",
    position: 1,
    pattern: "*@bounce.qa.test",
    outcome: "hard_bounce",
    smtp_code: "550 5.1.1",
    diagnostic: null,
    note: "",
    is_enabled: true,
    created_by: "ui",
  };

  test("EM-10.5 custom addresses win over magic addresses", () => {
    expect(
      resolveEmailOutcome("ops@bounce.qa.test", [bounceRule], true),
    ).toMatchObject({
      source: "custom",
      ruleId: "bounce-rule",
    });
  });

  test("EM-10.6 magic aliases match on any domain while switched on", () => {
    expect(
      resolveEmailOutcome("bounce+hard@shop.test", [], true),
    ).toMatchObject({
      source: "magic",
      magicRow: { outcome: "Hard bounce" },
    });
    expect(
      resolveEmailOutcome("success@simulator.amazonses.com", [], true),
    ).toMatchObject({
      source: "magic",
    });
    expect(resolveEmailOutcome("bounce@shop.test", [], false)).toEqual({
      source: "profile",
    });
  });
});

describe("validateSmsOutcomeRuleInput", () => {
  const validInput = {
    match_field: "to" as const,
    pattern: "+1555777*",
    outcome: "delayed_delivery" as const,
    error_code: null,
    delay_seconds: 10,
    note: "",
    is_enabled: true,
  };

  test("SM-07.7 accepts a valid rule", () => {
    expect(validateSmsOutcomeRuleInput(validInput)).toEqual({});
  });

  test("SM-07.7 needs a code for failures and a delay for delayed delivery", () => {
    expect(
      validateSmsOutcomeRuleInput({ ...validInput, outcome: "failed" })
        .error_code,
    ).toBe("Enter the error code, for example 30007");
    expect(
      validateSmsOutcomeRuleInput({ ...validInput, delay_seconds: 0 })
        .delay_seconds,
    ).toBe("Choose 1 to 3,600 seconds");
    expect(
      validateSmsOutcomeRuleInput({ ...validInput, pattern: "abc" }).pattern,
    ).toMatch(/^Use a number/);
  });
});

describe("validateEmailOutcomeRuleInput", () => {
  test("EM-10.5 checks the pattern and the SMTP code", () => {
    const fieldErrors = validateEmailOutcomeRuleInput({
      pattern: "not-an-address",
      outcome: "reject",
      smtp_code: "999",
      diagnostic: null,
      note: "",
      is_enabled: true,
    });

    expect(Object.keys(fieldErrors).sort()).toEqual(["pattern", "smtp_code"]);
  });
});
