import { describe, expect, test } from "vitest";

import type {
  EmailDetail,
  RuleFilter,
  RuleFilterOperator,
  SmsMessage,
} from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import type { RuleMessage } from "@/lib/webhooks/rule-filter/read-message-field";

/** Only the fields filters read; the rest of an email does not matter here. */
function buildEmailMessage(): RuleMessage {
  const emailFields: Partial<EmailDetail> = {
    from: { name: "Acme", address: "Billing@Acme.test" },
    to: [
      { name: "", address: "help@support.local" },
      { name: "", address: "ops@example.com" },
    ],
    cc: [],
    subject: "Ticket #42: printer on fire",
    text_body: "Your code is 482913",
    html_body: null,
    headers: { "X-Tenant": ["acme"] },
    tags: ["vip"],
    attachments: [],
    open_count: 1,
  };

  return { messageKind: "email", email: emailFields as EmailDetail };
}

function buildSmsMessage(): RuleMessage {
  const smsFields: Partial<SmsMessage> = {
    from_number: "+15550001111",
    to_number: "+8801700000000",
    body: "STOP",
    status: "delivered",
    api: "twilio",
    open_count: 0,
  };

  return { messageKind: "sms", smsMessage: smsFields as SmsMessage };
}

function condition(
  field: string,
  operator: RuleFilterOperator,
  value = "",
): RuleFilter {
  return { field, operator, value };
}

describe("evaluateRuleFilter", () => {
  test("WH-02.2 no filter matches everything", () => {
    expect(evaluateRuleFilter(null, buildEmailMessage())).toBe(true);
  });

  test("WH-02.2 each operator evaluates email fields, ignoring case except regex", () => {
    const emailMessage = buildEmailMessage();
    const expectedResults: [RuleFilter, boolean][] = [
      [condition("from", "equals", "billing@acme.test"), true],
      [condition("subject", "contains", "TICKET"), true],
      [condition("subject", "starts_with", "ticket #"), true],
      [condition("to", "matches", "*@support.local"), true],
      [condition("to", "matches", "*@acme.test"), false],
      [condition("subject", "regex", "#\\d+"), true],
      [condition("subject", "regex", "ticket"), false],
      [condition("cc", "exists"), false],
      [condition("tag", "exists"), true],
      [condition("header:x-tenant", "equals", "acme"), true],
      [condition("has_attachment", "equals", "false"), true],
      [condition("first_open", "equals", "true"), true],
      [condition("body", "contains", "482913"), true],
    ];

    for (const [ruleFilter, isExpectedMatch] of expectedResults) {
      expect(
        evaluateRuleFilter(ruleFilter, emailMessage),
        JSON.stringify(ruleFilter),
      ).toBe(isExpectedMatch);
    }
  });

  test("WH-02.2 SMS fields evaluate and email-only fields never match an SMS", () => {
    const smsMessage = buildSmsMessage();

    expect(
      evaluateRuleFilter(condition("body", "equals", "stop"), smsMessage),
    ).toBe(true);
    expect(
      evaluateRuleFilter(
        condition("status", "equals", "delivered"),
        smsMessage,
      ),
    ).toBe(true);
    expect(
      evaluateRuleFilter(condition("api", "equals", "twilio"), smsMessage),
    ).toBe(true);
    expect(
      evaluateRuleFilter(condition("to", "starts_with", "+880"), smsMessage),
    ).toBe(true);
    expect(evaluateRuleFilter(condition("subject", "exists"), smsMessage)).toBe(
      false,
    );
    expect(
      evaluateRuleFilter(condition("subject", "contains", ""), smsMessage),
    ).toBe(false);
  });

  test("WH-02.2 all, any and not combine conditions", () => {
    const emailMessage = buildEmailMessage();
    const matchingCondition = condition("subject", "contains", "ticket");
    const failingCondition = condition("subject", "contains", "invoice");

    expect(
      evaluateRuleFilter(
        { all: [matchingCondition, failingCondition] },
        emailMessage,
      ),
    ).toBe(false);
    expect(
      evaluateRuleFilter(
        { any: [matchingCondition, failingCondition] },
        emailMessage,
      ),
    ).toBe(true);
    expect(evaluateRuleFilter({ not: failingCondition }, emailMessage)).toBe(
      true,
    );
    expect(
      evaluateRuleFilter(
        { all: [matchingCondition, { not: { any: [failingCondition] } }] },
        emailMessage,
      ),
    ).toBe(true);
  });

  test("an invalid regex never matches instead of throwing", () => {
    expect(
      evaluateRuleFilter(
        condition("subject", "regex", "("),
        buildEmailMessage(),
      ),
    ).toBe(false);
  });
});
