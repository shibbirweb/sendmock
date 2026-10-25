import type { RuleFilter } from "@/lib/api/types";
import {
  findRuleFieldDefinition,
  headerFieldPrefix,
} from "@/lib/webhooks/rule-filter/rule-fields";
import { ruleOperators } from "@/lib/webhooks/rule-filter/rule-operators";

function describeField(fieldKey: string): string {
  if (fieldKey.startsWith(headerFieldPrefix)) {
    return `header ${fieldKey.slice(headerFieldPrefix.length)}`;
  }

  return (findRuleFieldDefinition(fieldKey)?.label ?? fieldKey).toLowerCase();
}

function describeNode(ruleFilter: RuleFilter, isNested: boolean): string {
  if ("not" in ruleFilter) {
    return `not ${describeNode(ruleFilter.not, true)}`;
  }
  if ("all" in ruleFilter || "any" in ruleFilter) {
    const joinWord = "all" in ruleFilter ? " and " : " or ";
    const childFilters = "all" in ruleFilter ? ruleFilter.all : ruleFilter.any;
    const groupText = childFilters
      .map((childFilter) => describeNode(childFilter, true))
      .join(joinWord);

    return isNested && childFilters.length > 1 ? `(${groupText})` : groupText;
  }

  const ruleOperator = ruleOperators[ruleFilter.operator];
  const fieldText = describeField(ruleFilter.field);

  return ruleOperator.needsValue
    ? `${fieldText} ${ruleOperator.summaryVerb} ${ruleFilter.value}`
    : `${fieldText} ${ruleOperator.summaryVerb}`;
}

/** "to matches *@support.local and subject contains Ticket" (WH-02.6). */
export function describeRuleFilter(ruleFilter: RuleFilter | null): string {
  if (ruleFilter === null) {
    return "Every event";
  }

  return describeNode(ruleFilter, false);
}
