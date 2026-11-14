/** Values saved by earlier steps, by their `save` name. */
export type ScenarioValues = Record<string, unknown>;

function readPath(scenarioValues: ScenarioValues, valuePath: string): unknown {
  return valuePath
    .split(".")
    .reduce<unknown>(
      (currentValue, pathPart) =>
        typeof currentValue === "object" && currentValue !== null
          ? (currentValue as Record<string, unknown>)[pathPart]
          : undefined,
      scenarioValues,
    );
}

/** `{{ path }}` or `{{ path | length }}` to its value. */
function evaluateExpression(
  scenarioValues: ScenarioValues,
  expressionText: string,
): unknown {
  const [valuePath = "", filterName] = expressionText
    .split("|")
    .map((part) => part.trim());
  const pathValue = readPath(scenarioValues, valuePath);
  if (filterName === "length") {
    return Array.isArray(pathValue) || typeof pathValue === "string"
      ? pathValue.length
      : 0;
  }

  return pathValue;
}

/** Fills `{{ ... }}` in a string; a string that is only one placeholder keeps its type. */
export function fillTemplate(
  scenarioValues: ScenarioValues,
  templateText: string,
): unknown {
  const onlyPlaceholder = /^\{\{(.+?)\}\}$/.exec(templateText.trim());
  if (onlyPlaceholder !== null) {
    return evaluateExpression(scenarioValues, onlyPlaceholder[1] ?? "");
  }

  return templateText.replaceAll(
    /\{\{(.+?)\}\}/g,
    (_placeholder, expressionText: string) =>
      String(evaluateExpression(scenarioValues, expressionText) ?? ""),
  );
}

/** Fills every string inside a step's `with` table. */
export function fillStepInput(
  scenarioValues: ScenarioValues,
  stepInput: unknown,
): unknown {
  if (typeof stepInput === "string") {
    return fillTemplate(scenarioValues, stepInput);
  }
  if (Array.isArray(stepInput)) {
    return stepInput.map((item) => fillStepInput(scenarioValues, item));
  }
  if (typeof stepInput === "object" && stepInput !== null) {
    return Object.fromEntries(
      Object.entries(stepInput).map(([key, value]) => [
        key,
        fillStepInput(scenarioValues, value),
      ]),
    );
  }

  return stepInput;
}

const comparisonPattern = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

/** An `assert` step's `that`: a comparison of two filled values, or a truthy value. */
export function evaluateAssertion(filledText: string): boolean {
  const comparisonMatch = comparisonPattern.exec(filledText.trim());
  if (comparisonMatch === null) {
    return (
      filledText.trim() !== "" &&
      filledText.trim() !== "false" &&
      filledText.trim() !== "0"
    );
  }
  const [, leftText = "", operator, rightText = ""] = comparisonMatch;
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  const isNumeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
  const left = isNumeric ? leftNumber : leftText.trim();
  const right = isNumeric ? rightNumber : rightText.trim();
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    default:
      return left < right;
  }
}
