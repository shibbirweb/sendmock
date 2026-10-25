import type {
  RuleCondition,
  RuleFilter,
  WebhookRuleInput,
} from "@/lib/api/types";
import {
  findRuleFieldDefinition,
  headerFieldPrefix,
} from "@/lib/webhooks/rule-filter/rule-fields";
import {
  readRegexError,
  ruleOperators,
} from "@/lib/webhooks/rule-filter/rule-operators";

export type WebhookRuleFieldErrors = Partial<
  Record<keyof WebhookRuleInput, string>
>;

/** The problem with one condition, or undefined when it is complete (WH-02.5). */
export function validateRuleCondition(
  condition: RuleCondition,
): string | undefined {
  if (findRuleFieldDefinition(condition.field) === undefined) {
    return "Pick a field";
  }
  if (condition.field === headerFieldPrefix) {
    return "Enter the header name";
  }
  if (!(condition.operator in ruleOperators)) {
    return "Pick an operator";
  }
  if (
    ruleOperators[condition.operator].needsValue &&
    condition.value.trim() === ""
  ) {
    return "Enter a value";
  }
  if (condition.operator === "regex") {
    const regexError = readRegexError(condition.value);
    if (regexError !== null) {
      return `Invalid regex: ${regexError}`;
    }
  }

  return undefined;
}

/** The first incomplete condition anywhere in a filter. */
export function findFirstFilterError(
  ruleFilter: RuleFilter | null,
): string | undefined {
  if (ruleFilter === null) {
    return undefined;
  }
  if ("all" in ruleFilter) {
    return ruleFilter.all.map(findFirstFilterError).find(Boolean);
  }
  if ("any" in ruleFilter) {
    return ruleFilter.any.map(findFirstFilterError).find(Boolean);
  }
  if ("not" in ruleFilter) {
    return findFirstFilterError(ruleFilter.not);
  }

  return validateRuleCondition(ruleFilter);
}

/** Rules for a webhook rule, shared by the editor and the API. */
export function validateWebhookRuleInput(
  ruleInput: WebhookRuleInput,
): WebhookRuleFieldErrors {
  const fieldErrors: WebhookRuleFieldErrors = {};

  if (ruleInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (ruleInput.endpoint_id === "") {
    fieldErrors.endpoint_id = "Pick an endpoint";
  }
  if (ruleInput.events.length === 0) {
    fieldErrors.events = "Pick at least one event";
  }
  const filterError = findFirstFilterError(ruleInput.filter);
  if (filterError !== undefined) {
    fieldErrors.filter = filterError;
  }

  return fieldErrors;
}
