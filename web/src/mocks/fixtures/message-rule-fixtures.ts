import type { ForwardRule, TagRule } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

/** Tag and auto-forward rules, kept together in the mock database. */
export type MessageRuleSets = {
  tagRules: TagRule[];
  forwardRules: ForwardRule[];
};

/** One tag rule and one switched-off forward rule, so both cards show a row. */
export function buildMessageRuleFixtures(): MessageRuleSets {
  return {
    tagRules: [
      {
        id: createMockUlid(),
        name: "Billing mail",
        filter: { field: "subject", operator: "contains", value: "Invoice" },
        tag: "billing",
        is_enabled: true,
        position: 1,
      },
    ],
    forwardRules: [
      {
        id: createMockUlid(),
        name: "QA inbox to the team",
        filter: { field: "to", operator: "matches", value: "*@qa.app.test" },
        to: ["qa-team@company.com"],
        is_enabled: false,
        position: 1,
      },
    ],
  };
}
