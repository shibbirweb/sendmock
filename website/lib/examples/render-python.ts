/** The Python tab: a pytest test with `requests`. */
import {
  type ApiStep,
  buildQueryString,
  type CodeExample,
  type ExampleStep,
  isFieldReference,
  splitApiPath,
  splitFieldPath,
  type StepValue,
  toSnakeWords,
} from "./example-types";
import {
  type ExampleRenderer,
  indentLines,
  joinStepLines,
  quoteDouble,
  layoutEntries,
} from "./render-shared";

/** Lines past this length split their arguments onto lines of their own. */
const maxLineLength = 84;

function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number" ? `[${pathPart}]` : `["${pathPart}"]`,
    )
    .join("")}`;
}

function renderPythonValue(stepValue: StepValue, indent = ""): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quoteDouble(stepValue);
  }
  if (typeof stepValue === "boolean") {
    return stepValue ? "True" : "False";
  }
  if (typeof stepValue === "number") {
    return String(stepValue);
  }
  const childIndent = `${indent}    `;
  if (Array.isArray(stepValue)) {
    return layoutEntries({
      open: "[",
      close: "]",
      entries: stepValue.map((item) => renderPythonValue(item, childIndent)),
      indent,
      indentUnit: "    ",
      hasTrailingComma: true,
    });
  }
  return layoutEntries({
    open: "{",
    close: "}",
    entries: Object.entries(stepValue).map(
      ([key, value]) =>
        `${quoteDouble(key)}: ${renderPythonValue(value, childIndent)}`,
    ),
    indent,
    indentUnit: "    ",
    hasTrailingComma: true,
  });
}

/** An f-string; path values from earlier answers use single quotes inside. */
function renderUrl(baseName: string, apiStep: ApiStep): string {
  const pathText = splitApiPath(apiStep)
    .map((pathPart) => {
      if (pathPart.kind === "text") {
        return pathPart.text;
      }
      return isFieldReference(pathPart.value)
        ? `{${renderReference(pathPart.value.answerName, pathPart.value.fieldPath).replace(/"/g, "'")}}`
        : String(pathPart.value);
    })
    .join("");
  const queryText =
    apiStep.method === "GET" ? "" : buildQueryString(apiStep.query);

  return `f"{${baseName}}${pathText}${queryText}"`;
}

/** `requests.post(url, json=...)`, split over lines when long. */
function renderCall(
  prefix: string,
  functionName: string,
  callArguments: string[],
  suffix: string,
): string[] {
  const singleLine = `${prefix}${functionName}(${callArguments.join(", ")})${suffix}`;
  if (singleLine.length <= maxLineLength && !singleLine.includes("\n")) {
    return [singleLine];
  }

  return [
    `${prefix}${functionName}(`,
    ...callArguments.map((callArgument) => `    ${callArgument},`),
    `)${suffix}`,
  ];
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)}`,
    ];
  }
  if (exampleStep.kind === "app") {
    const callArguments = [
      `f"{APP}${exampleStep.path}"`,
      ...(exampleStep.body === undefined
        ? []
        : [`json=${renderPythonValue(exampleStep.body, "    ")}`]),
    ];
    return renderCall(
      "",
      `requests.${exampleStep.method.toLowerCase()}`,
      callArguments,
      "",
    );
  }
  if (exampleStep.kind === "expect") {
    const expectedText =
      typeof exampleStep.value === "boolean"
        ? exampleStep.value
          ? "True"
          : "False"
        : JSON.stringify(exampleStep.value);
    const comparison = typeof exampleStep.value === "boolean" ? "is" : "==";
    return [
      `assert ${renderReference(exampleStep.answerName, exampleStep.fieldPath)} ${comparison} ${expectedText}`,
    ];
  }
  const callArguments = [
    renderUrl("SENDMOCK", exampleStep),
    ...(exampleStep.method === "GET" && exampleStep.query !== undefined
      ? [`params=${renderPythonValue(exampleStep.query, "    ")}`]
      : []),
    ...(exampleStep.body === undefined
      ? []
      : [`json=${renderPythonValue(exampleStep.body, "    ")}`]),
  ];
  return exampleStep.answerName === undefined
    ? renderCall(
        "",
        `requests.${exampleStep.method.toLowerCase()}`,
        callArguments,
        ".raise_for_status()",
      )
    : renderCall(
        `${exampleStep.answerName} = `,
        `requests.${exampleStep.method.toLowerCase()}`,
        callArguments,
        ".json()",
      );
}

export const pythonRenderer: ExampleRenderer = {
  tabName: "Python",
  fenceLanguage: "python",
  render: (codeExample: CodeExample) =>
    [
      "import requests",
      "",
      'SENDMOCK = "http://127.0.0.1:8025/api/v1"',
      'APP = "http://localhost:8000"',
      "",
      "",
      `def test_${toSnakeWords(codeExample.testName)}():`,
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "    "),
    ].join("\n"),
};
