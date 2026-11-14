import type {
  AppSettings,
  EmailOutcomeRule,
  OutcomeTestResult,
  SmsOutcomeRule,
} from "@/lib/api/types";
import { describeResolution } from "@/lib/outcomes/describe-resolution";
import {
  describeEmailRuleOutcome,
  describeSmsRuleOutcome,
} from "@/lib/outcomes/outcome-rule-labels";
import {
  type OutcomeResolution,
  resolveEmailOutcome,
  resolveSmsOutcome,
} from "@/lib/outcomes/resolve-outcome";

function toTestResult(
  resolution: OutcomeResolution,
  summary: string,
): OutcomeTestResult {
  return {
    source: resolution.source,
    rule_id: resolution.source === "custom" ? resolution.ruleId : null,
    rule_position:
      resolution.source === "custom" ? resolution.rulePosition : null,
    summary,
  };
}

function describeRule<OutcomeRule extends { id: string }>(
  outcomeRules: OutcomeRule[],
  describeOutcome: (outcomeRule: OutcomeRule) => string,
) {
  return (ruleId: string) => {
    const outcomeRule = outcomeRules.find(
      (existingRule) => existingRule.id === ruleId,
    );

    return outcomeRule === undefined ? "" : describeOutcome(outcomeRule);
  };
}

/** What happens to mail for an address: `POST /outcome-rules/email/test` (EM-10.6). */
export function testEmailOutcome(
  address: string,
  outcomeRules: EmailOutcomeRule[],
  appSettings: Pick<
    AppSettings,
    "is_magic_addresses_enabled" | "email_outcome_profile"
  >,
): OutcomeTestResult {
  const resolution = resolveEmailOutcome(
    address.trim(),
    outcomeRules,
    appSettings.is_magic_addresses_enabled,
  );

  return toTestResult(
    resolution,
    describeResolution(
      resolution,
      describeRule(outcomeRules, describeEmailRuleOutcome),
      "Magic address",
      `No rule or magic address matches: the ${appSettings.email_outcome_profile} outcome profile applies.`,
    ),
  );
}

/** What happens to an SMS for a number: `POST /outcome-rules/sms/test` (SM-07.9). */
export function testSmsOutcome(
  phoneNumber: string,
  matchField: "to" | "from",
  outcomeRules: SmsOutcomeRule[],
  appSettings: Pick<
    AppSettings,
    "is_magic_numbers_enabled" | "sms_simulation_profile"
  >,
): OutcomeTestResult {
  const resolution = resolveSmsOutcome(
    phoneNumber.trim(),
    matchField,
    outcomeRules,
    appSettings.is_magic_numbers_enabled,
  );

  return toTestResult(
    resolution,
    describeResolution(
      resolution,
      describeRule(outcomeRules, describeSmsRuleOutcome),
      "Magic number",
      `No rule or magic number matches: the ${appSettings.sms_simulation_profile} profile applies.`,
    ),
  );
}
