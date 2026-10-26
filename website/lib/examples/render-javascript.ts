/** The JavaScript tab: a Vitest test with the `call` helper from the Node.js Connect page. */
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
  hasChecks,
  indentLines,
  joinStepLines,
  quoteDouble,
  usesAppCalls,
} from "./render-shared";

function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number" ? `[${pathPart}]` : `.${pathPart}`,
    )
    .join("")}`;
}

function renderKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : quoteDouble(key);
}

function renderJavaScriptValue(stepValue: StepValue, indent: string): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quoteDouble(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  if (Array.isArray(stepValue)) {
    return `[${stepValue.map((item) => renderJavaScriptValue(item, indent)).join(", ")}]`;
  }
  const entries = Object.entries(stepValue).map(
    ([key, value]) =>
      `${renderKey(key)}: ${renderJavaScriptValue(value, `${indent}  `)}`,
  );
  const inline = `{ ${entries.join(", ")} }`;
  if (inline.length <= 60 && !inline.includes("\n")) {
    return inline;
  }

  return `{\n${entries.map((entry) => `${indent}  ${entry},`).join("\n")}\n${indent}}`;
}

function renderUrl(apiStep: ApiStep): string {
  const pathText = splitApiPath(apiStep)
    .map((pathPart) => {
      if (pathPart.kind === "text") {
        return pathPart.text;
      }
      return isFieldReference(pathPart.value)
        ? `\${${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}}`
        : String(pathPart.value);
    })
    .join("");

  return `\`\${SENDMOCK}${pathText}${buildQueryString(apiStep.query)}\``;
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `const ${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)};`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? ""
        : `, ${renderJavaScriptValue(exampleStep.body, "")}`;
    return `await call(${quoteDouble(exampleStep.method)}, \`\${APP}${exampleStep.path}\`${bodyText});`.split(
      "\n",
    );
  }
  if (exampleStep.kind === "expect") {
    return [
      `expect(${renderReference(exampleStep.answerName, exampleStep.fieldPath)}).toBe(${JSON.stringify(exampleStep.value)});`,
    ];
  }
  const bodyText =
    exampleStep.body === undefined
      ? ""
      : `, ${renderJavaScriptValue(exampleStep.body, "")}`;
  const callText = `await call(${quoteDouble(exampleStep.method)}, ${renderUrl(exampleStep)}${bodyText});`;

  return (
    exampleStep.answerName === undefined
      ? callText
      : `const ${exampleStep.answerName} = ${callText}`
  ).split("\n");
}

export const javaScriptRenderer: ExampleRenderer = {
  tabName: "JavaScript",
  fenceLanguage: "js",
  render: (codeExample: CodeExample) =>
    [
      `import { ${hasChecks(codeExample) ? "expect, " : ""}test } from "vitest";`,
      "",
      `import { ${usesAppCalls(codeExample) ? "APP, " : ""}call, SENDMOCK } from "./sendmock.js";`,
      "",
      `test(${quoteDouble(codeExample.testName)}, async () => {`,
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "  "),
      "});",
    ].join("\n"),
};
