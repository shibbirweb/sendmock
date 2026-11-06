import type { EndStateCheck } from "./eval-case";

export type EndStateResult = {
  check: EndStateCheck;
  isPassed: boolean;
  detail: string;
};

/** The answer's items: an array, a page's `items`, or the answer itself. */
export function readAnswerItems(answer: unknown): unknown[] {
  if (Array.isArray(answer)) {
    return answer;
  }
  const listedItems = (answer as { items?: unknown } | null)?.items;
  return Array.isArray(listedItems) ? listedItems : [answer];
}

/** An expected list matches a list holding all its values; anything else must be equal. */
function matchesValue(actualValue: unknown, expectedValue: unknown): boolean {
  if (Array.isArray(expectedValue)) {
    return (
      Array.isArray(actualValue) &&
      expectedValue.every((expectedEntry) =>
        actualValue.some(
          (actualEntry) =>
            JSON.stringify(actualEntry) === JSON.stringify(expectedEntry),
        ),
      )
    );
  }
  return JSON.stringify(actualValue) === JSON.stringify(expectedValue);
}

export function matchesFields(
  item: unknown,
  fields: Record<string, unknown>,
): boolean {
  const itemFields = (item ?? {}) as Record<string, unknown>;
  return Object.entries(fields).every(([fieldName, expectedValue]) =>
    matchesValue(itemFields[fieldName], expectedValue),
  );
}

export async function checkEndState(
  checks: EndStateCheck[],
  readAnswer: (path: string) => Promise<unknown>,
): Promise<EndStateResult[]> {
  const results: EndStateResult[] = [];
  for (const check of checks) {
    const items = readAnswerItems(await readAnswer(check.path));
    const isPassed = items.some((item) => matchesFields(item, check.fields));
    results.push({
      check,
      isPassed,
      detail: isPassed
        ? `an item of ${check.path} has ${JSON.stringify(check.fields)}`
        : `no item of ${check.path} (${items.length} read) has ${JSON.stringify(check.fields)}`,
    });
  }
  return results;
}
