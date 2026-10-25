import { describe, expect, test } from "vitest";

import type { RuleFilter, WebhookRuleInput } from "@/lib/api/types";
import {
  createNodeIdGenerator,
  toBuilderTree,
  toRuleFilter,
} from "@/lib/webhooks/rule-filter/builder-tree";
import { describeRuleFilter } from "@/lib/webhooks/rule-filter/describe-rule-filter";
import { listFieldsForEvents } from "@/lib/webhooks/rule-filter/rule-fields";
import {
  validateRuleCondition,
  validateWebhookRuleInput,
} from "@/lib/webhooks/rule-filter/validate-rule-filter";

describe("builder tree", () => {
  test("WH-02.5 round-trips all, any, not and a nested group", () => {
    const ruleFilters: RuleFilter[] = [
      { all: [{ field: "to", operator: "matches", value: "*@support.local" }] },
      {
        any: [
          { field: "subject", operator: "contains", value: "Ticket" },
          {
            not: {
              field: "header:X-Tenant",
              operator: "equals",
              value: "acme",
            },
          },
          {
            all: [
              { field: "tag", operator: "exists", value: "" },
              { field: "body", operator: "regex", value: "\\d{6}" },
            ],
          },
        ],
      },
      {
        not: {
          all: [{ field: "from", operator: "equals", value: "a@b.test" }],
        },
      },
    ];

    for (const ruleFilter of ruleFilters) {
      expect(
        toRuleFilter(toBuilderTree(ruleFilter, createNodeIdGenerator())),
      ).toEqual(ruleFilter);
    }
  });

  test("WH-02.5 no filter is an empty root, and an empty root is no filter", () => {
    const rootGroup = toBuilderTree(null, createNodeIdGenerator());

    expect(rootGroup.children).toEqual([]);
    expect(toRuleFilter(rootGroup)).toBeNull();
  });

  test("a bare condition gets a root group", () => {
    const rootGroup = toBuilderTree(
      { field: "body", operator: "contains", value: "STOP" },
      createNodeIdGenerator(),
    );

    expect(rootGroup.combinator).toBe("all");
    expect(toRuleFilter(rootGroup)).toEqual({
      all: [{ field: "body", operator: "contains", value: "STOP" }],
    });
  });
});

describe("describeRuleFilter", () => {
  test("WH-02.6 writes filters in plain language", () => {
    expect(describeRuleFilter(null)).toBe("Every event");
    expect(
      describeRuleFilter({
        all: [
          { field: "to", operator: "matches", value: "*@support.local" },
          { field: "subject", operator: "contains", value: "Ticket" },
        ],
      }),
    ).toBe("to matches *@support.local and subject contains Ticket");
    expect(
      describeRuleFilter({
        any: [
          { not: { field: "header:X-Tenant", operator: "exists", value: "" } },
          {
            all: [
              { field: "status", operator: "equals", value: "failed" },
              { field: "api", operator: "equals", value: "twilio" },
            ],
          },
        ],
      }),
    ).toBe(
      "not header X-Tenant exists or (sms status is failed and sms api is twilio)",
    );
  });
});

describe("rule validation", () => {
  test("WH-02.5 flags missing values, bad regex and missing header names", () => {
    expect(
      validateRuleCondition({
        field: "subject",
        operator: "contains",
        value: " ",
      }),
    ).toBe("Enter a value");
    expect(
      validateRuleCondition({
        field: "subject",
        operator: "exists",
        value: "",
      }),
    ).toBe(undefined);
    expect(
      validateRuleCondition({
        field: "subject",
        operator: "regex",
        value: "(",
      }),
    ).toMatch(/^Invalid regex/);
    expect(
      validateRuleCondition({
        field: "header:",
        operator: "exists",
        value: "",
      }),
    ).toBe("Enter the header name");
    expect(
      validateRuleCondition({
        field: "colour",
        operator: "equals",
        value: "red",
      }),
    ).toBe("Pick a field");
  });

  test("WH-02.5 a rule needs a name, an endpoint, events and a complete filter", () => {
    const ruleInput: WebhookRuleInput = {
      name: "",
      endpoint_id: "",
      events: [],
      filter: { all: [{ field: "subject", operator: "contains", value: "" }] },
      is_enabled: true,
    };

    expect(validateWebhookRuleInput(ruleInput)).toEqual({
      name: "Enter a name",
      endpoint_id: "Pick an endpoint",
      events: "Pick at least one event",
      filter: "Enter a value",
    });
  });
});

describe("listFieldsForEvents", () => {
  test("offers email fields for email events, SMS fields for SMS events, both for both", () => {
    const fieldKeys = (events: Parameters<typeof listFieldsForEvents>[0]) =>
      listFieldsForEvents(events).map(
        (fieldDefinition) => fieldDefinition.fieldKey,
      );

    expect(fieldKeys(["email.received"])).toContain("subject");
    expect(fieldKeys(["email.received"])).not.toContain("status");
    expect(fieldKeys(["sms.status"])).toContain("status");
    expect(fieldKeys(["sms.status"])).not.toContain("subject");
    expect(fieldKeys(["email.opened"])).toContain("open_count");
    expect(fieldKeys(["verify.started"])).toEqual([]);
  });
});
