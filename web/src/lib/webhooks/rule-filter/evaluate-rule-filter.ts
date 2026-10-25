import type { RuleCondition, RuleFilter } from "@/lib/api/types";
import {
  type RuleMessage,
  readMessageField,
} from "@/lib/webhooks/rule-filter/read-message-field";
import { ruleOperators } from "@/lib/webhooks/rule-filter/rule-operators";

function evaluateCondition(
  condition: RuleCondition,
  ruleMessage: RuleMessage,
): boolean {
  const fieldValues = readMessageField(ruleMessage, condition.field);
  // A field the message does not have never matches.
  if (fieldValues === null) {
    return false;
  }

  const ruleOperator = ruleOperators[condition.operator];

  return fieldValues.some((fieldValue) =>
    ruleOperator.testValue(fieldValue, condition.value),
  );
}

/** Whether a message passes a filter; no filter passes everything (WH-02.2). */
export function evaluateRuleFilter(
  ruleFilter: RuleFilter | null,
  ruleMessage: RuleMessage,
): boolean {
  if (ruleFilter === null) {
    return true;
  }
  if ("all" in ruleFilter) {
    return ruleFilter.all.every((childFilter) =>
      evaluateRuleFilter(childFilter, ruleMessage),
    );
  }
  if ("any" in ruleFilter) {
    return ruleFilter.any.some((childFilter) =>
      evaluateRuleFilter(childFilter, ruleMessage),
    );
  }
  if ("not" in ruleFilter) {
    return !evaluateRuleFilter(ruleFilter.not, ruleMessage);
  }

  return evaluateCondition(ruleFilter, ruleMessage);
}
