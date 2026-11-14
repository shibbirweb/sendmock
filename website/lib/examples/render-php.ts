/** The PHP tab: a Laravel feature test (Pest) with the `Http` client. */
import {
  type ApiStep,
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
} from "./render-shared";

function quotePhp(text: string): string {
  if (text.includes("\n")) {
    // Double quotes, so a line break reads as \n.
    return JSON.stringify(text).replace(/\$/g, "\\$");
  }

  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function renderReference(answerName: string, fieldPath: string): string {
  return `$${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number" ? `[${pathPart}]` : `['${pathPart}']`,
    )
    .join("")}`;
}

function renderPhpValue(stepValue: StepValue, indent: string): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quotePhp(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  const entries = Array.isArray(stepValue)
    ? stepValue.map((item) => renderPhpValue(item, `${indent}    `))
    : Object.entries(stepValue).map(
        ([key, value]) =>
          `${quotePhp(key)} => ${renderPhpValue(value, `${indent}    `)}`,
      );
  const inline = `[${entries.join(", ")}]`;
  if (entries.length <= 1 && inline.length <= 60 && !inline.includes("\n")) {
    return inline;
  }

  return `[\n${entries.map((entry) => `${indent}    ${entry},`).join("\n")}\n${indent}]`;
}

function renderUrl(apiStep: ApiStep, withQuery: boolean): string {
  const pathParts = splitApiPath(apiStep);
  const hasValues = pathParts.some((pathPart) => pathPart.kind === "value");
  const queryText =
    withQuery && apiStep.query
      ? `?${new URLSearchParams(apiStep.query).toString()}`
      : "";
  if (!hasValues) {
    return `SENDMOCK.${quotePhp(`${pathParts.map((pathPart) => (pathPart.kind === "text" ? pathPart.text : "")).join("")}${queryText}`)}`;
  }
  const interpolated = pathParts
    .map((pathPart) => {
      if (pathPart.kind === "text") {
        return pathPart.text;
      }
      return isFieldReference(pathPart.value)
        ? `{${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}}`
        : String(pathPart.value);
    })
    .join("");

  return `SENDMOCK."${interpolated}${queryText}"`;
}

function renderApiStep(apiStep: ApiStep): string[] {
  const httpMethod = apiStep.method.toLowerCase();
  const isGet = apiStep.method === "GET";
  const payload = isGet ? apiStep.query : apiStep.body;
  const callArguments = [
    renderUrl(apiStep, !isGet),
    ...(payload === undefined ? [] : [renderPhpValue(payload, "")]),
  ];
  const callText = `Http::${httpMethod}(${callArguments.join(", ")})->throw()`;

  return `${apiStep.answerName === undefined ? callText : `$${apiStep.answerName} = ${callText}->json()`};`.split(
    "\n",
  );
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `$${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)};`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? ""
        : `, ${renderPhpValue(exampleStep.body, "")}`;
    return `$this->${exampleStep.method.toLowerCase()}(${quotePhp(exampleStep.path)}${bodyText});`.split(
      "\n",
    );
  }
  if (exampleStep.kind === "expect") {
    const expectedText =
      typeof exampleStep.value === "string"
        ? quotePhp(exampleStep.value)
        : String(exampleStep.value);
    return [
      `expect(${renderReference(exampleStep.answerName, exampleStep.fieldPath)})->toBe(${expectedText});`,
    ];
  }

  return renderApiStep(exampleStep);
}

export const phpRenderer: ExampleRenderer = {
  tabName: "PHP",
  fenceLanguage: "php",
  render: (codeExample: CodeExample) =>
    [
      "<?php",
      "",
      "use Illuminate\\Support\\Facades\\Http;",
      "",
      "const SENDMOCK = 'http://127.0.0.1:8025/api/v1';",
      "",
      `it(${quotePhp(codeExample.testName)}, function () {`,
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "    "),
      "});",
    ].join("\n"),
};
