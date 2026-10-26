/** The Go tab: a `testing` test with the `call` helper from the Go Connect page. */
import type { ExampleContract } from "./example-contract";
import {
  type ApiStep,
  buildQueryString,
  type CodeExample,
  type ExampleStep,
  isFieldReference,
  splitApiPath,
  splitFieldPath,
  type StepValue,
} from "./example-types";
import {
  type ExampleRenderer,
  indentLines,
  joinStepLines,
  quoteDouble,
  readAnswerKinds,
  toPascalCase,
  layoutEntries,
} from "./render-shared";

/** `otp["items"].([]any)[0].(map[string]any)["status"]`. */
function renderReference(answerName: string, fieldPath: string): string {
  const pathParts = splitFieldPath(fieldPath);
  return pathParts.reduce<string>((expression, pathPart, partIndex) => {
    if (partIndex === 0) {
      return typeof pathPart === "number"
        ? `${expression}[${pathPart}]`
        : `${expression}[${quoteDouble(pathPart)}]`;
    }
    return typeof pathPart === "number"
      ? `${expression}.([]any)[${pathPart}]`
      : `${expression}.(map[string]any)[${quoteDouble(pathPart)}]`;
  }, answerName);
}

function renderGoValue(stepValue: StepValue, indent = ""): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quoteDouble(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  const childIndent = `${indent}\t`;
  if (Array.isArray(stepValue)) {
    return layoutEntries({
      open: "[]any{",
      close: "}",
      entries: stepValue.map((item) => renderGoValue(item, childIndent)),
      indent,
      indentUnit: "\t",
      hasTrailingComma: true,
    });
  }
  const keyedEntries = Object.entries(stepValue).map(([key, value]) => ({
    keyText: `${quoteDouble(key)}:`,
    valueText: renderGoValue(value, childIndent),
  }));
  const keyWidth = Math.max(
    ...keyedEntries.map((keyedEntry) => keyedEntry.keyText.length),
  );
  return layoutEntries({
    open: "map[string]any{",
    close: "}",
    entries: keyedEntries.map(
      (keyedEntry) => `${keyedEntry.keyText} ${keyedEntry.valueText}`,
    ),
    // gofmt lines the values up.
    multilineEntries: keyedEntries.map(
      (keyedEntry) =>
        `${keyedEntry.keyText.padEnd(keyWidth)} ${keyedEntry.valueText}`,
    ),
    indent,
    indentUnit: "\t",
    hasTrailingComma: true,
  });
}

function renderUrl(apiStep: ApiStep): string {
  const urlParts = ["sendmock"];
  let pendingText = "";
  for (const pathPart of splitApiPath(apiStep)) {
    if (pathPart.kind === "text") {
      pendingText += pathPart.text;
      continue;
    }
    if (isFieldReference(pathPart.value)) {
      urlParts.push(
        quoteDouble(pendingText),
        `${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}.(string)`,
      );
      pendingText = "";
    } else {
      pendingText += String(pathPart.value);
    }
  }
  pendingText += buildQueryString(apiStep.query);
  if (pendingText !== "") {
    urlParts.push(quoteDouble(pendingText));
  }

  return urlParts.join("+");
}

function renderExpectedValue(value: string | number | boolean): string {
  return typeof value === "number"
    ? `float64(${value})`
    : JSON.stringify(value);
}

function renderStep(
  exampleStep: ExampleStep,
  answerKinds: Map<string, "object" | "list">,
): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `${exampleStep.answerName} := ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)}.(map[string]any)`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined ? "nil" : renderGoValue(exampleStep.body);
    return [
      `call(t, ${quoteDouble(exampleStep.method)}, app+${quoteDouble(exampleStep.path)}, ${bodyText})`,
    ];
  }
  if (exampleStep.kind === "expect") {
    const fieldExpression = renderReference(
      exampleStep.answerName,
      exampleStep.fieldPath,
    );
    const expectedText = renderExpectedValue(exampleStep.value);
    return [
      `if got := ${fieldExpression}; got != ${expectedText} {`,
      `\tt.Errorf("${exampleStep.fieldPath} is %v, want %v", got, ${expectedText})`,
      "}",
    ];
  }
  const bodyText =
    exampleStep.body === undefined ? "nil" : renderGoValue(exampleStep.body);
  const callText = `call(t, ${quoteDouble(exampleStep.method)}, ${renderUrl(exampleStep)}, ${bodyText})`;
  if (exampleStep.answerName === undefined) {
    return [callText];
  }
  const answerType =
    answerKinds.get(exampleStep.answerName) === "list"
      ? "[]any"
      : "map[string]any";

  return [`${exampleStep.answerName} := ${callText}.(${answerType})`];
}

export const goRenderer: ExampleRenderer = {
  tabName: "Go",
  fenceLanguage: "go",
  render: (codeExample: CodeExample, exampleContract: ExampleContract) => {
    const answerKinds = readAnswerKinds(codeExample, exampleContract);
    return [
      "package app_test",
      "",
      'import "testing"',
      "",
      `func Test${toPascalCase(codeExample.testName)}(t *testing.T) {`,
      ...indentLines(
        joinStepLines(codeExample.steps, (exampleStep) =>
          renderStep(exampleStep, answerKinds),
        ),
        "\t",
      ),
      "}",
    ].join("\n");
  },
};
