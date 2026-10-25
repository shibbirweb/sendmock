import type { RuleFilterOperator } from "@/lib/api/types";

type RuleOperatorDefinition = {
  label: string;
  /** Words used in filter summaries, e.g. "starts with". */
  summaryVerb: string;
  needsValue: boolean;
  /** Whether one field value satisfies the condition value. */
  testValue: (fieldValue: string, conditionValue: string) => boolean;
};

function escapeRegexCharacters(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/** `*@support.local` style globs: `*` any run, `?` one character, whole value. */
export function globToRegex(globPattern: string): RegExp {
  const regexSource = escapeRegexCharacters(globPattern)
    .replaceAll("*", ".*")
    .replaceAll("?", ".");

  return new RegExp(`^${regexSource}$`, "i");
}

/** Null for a valid JavaScript regex, else the reason. */
export function readRegexError(regexSource: string): string | null {
  try {
    new RegExp(regexSource);
    return null;
  } catch (regexError) {
    return regexError instanceof Error
      ? regexError.message
      : "Invalid regular expression";
  }
}

/** One strategy per operator; text operators ignore case, `regex` does not. */
export const ruleOperators: Record<RuleFilterOperator, RuleOperatorDefinition> =
  {
    equals: {
      label: "equals",
      summaryVerb: "is",
      needsValue: true,
      testValue: (fieldValue, conditionValue) =>
        fieldValue.toLowerCase() === conditionValue.toLowerCase(),
    },
    contains: {
      label: "contains",
      summaryVerb: "contains",
      needsValue: true,
      testValue: (fieldValue, conditionValue) =>
        fieldValue.toLowerCase().includes(conditionValue.toLowerCase()),
    },
    starts_with: {
      label: "starts with",
      summaryVerb: "starts with",
      needsValue: true,
      testValue: (fieldValue, conditionValue) =>
        fieldValue.toLowerCase().startsWith(conditionValue.toLowerCase()),
    },
    matches: {
      label: "matches (glob)",
      summaryVerb: "matches",
      needsValue: true,
      testValue: (fieldValue, conditionValue) =>
        globToRegex(conditionValue).test(fieldValue),
    },
    regex: {
      label: "matches regex",
      summaryVerb: "matches regex",
      needsValue: true,
      testValue: (fieldValue, conditionValue) =>
        readRegexError(conditionValue) === null &&
        new RegExp(conditionValue).test(fieldValue),
    },
    exists: {
      label: "exists",
      summaryVerb: "exists",
      needsValue: false,
      testValue: (fieldValue) => fieldValue !== "",
    },
  };

export const ruleOperatorOrder: RuleFilterOperator[] = [
  "equals",
  "contains",
  "starts_with",
  "matches",
  "regex",
  "exists",
];
