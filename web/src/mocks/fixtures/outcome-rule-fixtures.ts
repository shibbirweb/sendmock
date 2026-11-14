import type { EmailOutcomeRule, SmsOutcomeRule } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

export function buildSmsOutcomeRuleFixtures(): SmsOutcomeRule[] {
  return [
    {
      id: createMockUlid(),
      position: 1,
      match_field: "to",
      pattern: "+15559990000",
      outcome: "undelivered",
      error_code: "30007",
      delay_seconds: null,
      note: "QA phone: carrier filter",
      is_enabled: true,
      created_by: "seed",
    },
    {
      id: createMockUlid(),
      position: 2,
      match_field: "to",
      pattern: "+1555777*",
      outcome: "delayed_delivery",
      error_code: null,
      delay_seconds: 10,
      note: "Slow network test range",
      is_enabled: true,
      created_by: "ui",
    },
  ];
}

export function buildEmailOutcomeRuleFixtures(): EmailOutcomeRule[] {
  return [
    {
      id: createMockUlid(),
      position: 1,
      pattern: "*@bounce.qa.test",
      outcome: "hard_bounce",
      smtp_code: "550 5.1.1",
      diagnostic: "User unknown",
      note: "Bounce handling tests",
      is_enabled: true,
      created_by: "seed",
    },
  ];
}
