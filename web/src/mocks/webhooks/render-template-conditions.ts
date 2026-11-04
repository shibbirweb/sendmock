/** Reads a context path for a condition; `undefined` when it is missing. */
type ConditionValueReader = (pathText: string) => unknown;

const innermostIfPattern =
  /\{%-?\s*if\s+([\s\S]+?)\s*-?%\}((?:(?!\{%-?\s*if\s)[\s\S])*?)\{%-?\s*endif\s*-?%\}/;
const elsePattern = /\{%-?\s*else\s*-?%\}/;
const comparisonPattern = /^(\S+)\s*(==|!=)\s*"([^"]*)"$/;

function isTruthy(conditionValue: unknown): boolean {
  if (Array.isArray(conditionValue)) {
    return conditionValue.length > 0;
  }

  return (
    conditionValue !== undefined &&
    conditionValue !== null &&
    conditionValue !== false &&
    conditionValue !== "" &&
    conditionValue !== 0
  );
}

function evaluateCondition(
  conditionText: string,
  readConditionValue: ConditionValueReader,
): boolean {
  const comparisonMatch = comparisonPattern.exec(conditionText);
  if (comparisonMatch === null) {
    return isTruthy(readConditionValue(conditionText));
  }

  const [, pathText = "", operator, expectedText] = comparisonMatch;
  const isEqual = String(readConditionValue(pathText) ?? "") === expectedText;

  return operator === "==" ? isEqual : !isEqual;
}

/**
 * Resolves `{% if %}` blocks, innermost first, with an optional `{% else %}`.
 * A condition is a context path (truthy as in Jinja) or a path compared to a
 * string with `==` or `!=`: the subset the built-in templates use.
 */
export function resolveTemplateConditions(
  templateText: string,
  readConditionValue: ConditionValueReader,
): string {
  let resolvedText = templateText;
  let ifMatch = innermostIfPattern.exec(resolvedText);
  while (ifMatch !== null) {
    const [wholeBlock, conditionText = "", blockBody = ""] = ifMatch;
    const [thenText = "", elseText = ""] = blockBody.split(elsePattern);
    const chosenText = evaluateCondition(conditionText, readConditionValue)
      ? thenText
      : elseText;
    resolvedText =
      resolvedText.slice(0, ifMatch.index) +
      chosenText +
      resolvedText.slice(ifMatch.index + wholeBlock.length);
    ifMatch = innermostIfPattern.exec(resolvedText);
  }

  return resolvedText;
}
