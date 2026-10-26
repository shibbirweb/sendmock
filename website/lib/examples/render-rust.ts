/** The Rust tab: a `#[tokio::test]` with `serde_json` and the `call` helper from the Rust Connect page. */
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
  usesAppCalls,
  layoutEntries,
} from "./render-shared";

function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number"
        ? `[${pathPart}]`
        : `[${quoteDouble(pathPart)}]`,
    )
    .join("")}`;
}

/** The inside of `json!(...)`; earlier answers' fields are cloned in. */
function renderJsonValue(stepValue: StepValue, indent = ""): string {
  if (isFieldReference(stepValue)) {
    return `${renderReference(stepValue.answerName, stepValue.fieldPath)}.clone()`;
  }
  if (typeof stepValue === "string") {
    return quoteDouble(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  const childIndent = `${indent}    `;
  if (Array.isArray(stepValue)) {
    return layoutEntries({
      open: "[",
      close: "]",
      entries: stepValue.map((item) => renderJsonValue(item, childIndent)),
      indent,
      indentUnit: "    ",
      hasTrailingComma: false,
    });
  }
  return layoutEntries({
    open: "{",
    close: "}",
    entries: Object.entries(stepValue).map(
      ([key, value]) =>
        `${quoteDouble(key)}: ${renderJsonValue(value, childIndent)}`,
    ),
    indent,
    indentUnit: "    ",
    hasTrailingComma: false,
  });
}

/** `&format!("{SENDMOCK}/emails/{}/simulate", email["id"].as_str().unwrap())`. */
function renderUrl(baseName: string, apiStep: ApiStep): string {
  const formatArguments: string[] = [];
  const formatText = splitApiPath(apiStep)
    .map((pathPart) => {
      if (pathPart.kind === "text") {
        return pathPart.text;
      }
      if (isFieldReference(pathPart.value)) {
        formatArguments.push(
          `${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}.as_str().unwrap()`,
        );
        return "{}";
      }
      return String(pathPart.value);
    })
    .join("");

  return `&format!(${[`"{${baseName}}${formatText}${buildQueryString(apiStep.query)}"`, ...formatArguments].join(", ")})`;
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `let ${exampleStep.answerName} = &${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)};`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? "None"
        : `Some(json!(${renderJsonValue(exampleStep.body)}))`;
    return [
      `call(${quoteDouble(exampleStep.method)}, &format!("{APP}${exampleStep.path}"), ${bodyText}).await;`,
    ];
  }
  if (exampleStep.kind === "expect") {
    return [
      `assert_eq!(${renderReference(exampleStep.answerName, exampleStep.fieldPath)}, ${JSON.stringify(exampleStep.value)});`,
    ];
  }
  const bodyText =
    exampleStep.body === undefined
      ? "None"
      : `Some(json!(${renderJsonValue(exampleStep.body)}))`;
  const callText = `call(${quoteDouble(exampleStep.method)}, ${renderUrl("SENDMOCK", exampleStep)}, ${bodyText}).await;`;

  return [
    exampleStep.answerName === undefined
      ? callText
      : `let ${exampleStep.answerName} = ${callText}`,
  ];
}

export const rustRenderer: ExampleRenderer = {
  tabName: "Rust",
  fenceLanguage: "rust",
  render: (codeExample: CodeExample) => {
    const usesJson = codeExample.steps.some(
      (exampleStep) =>
        (exampleStep.kind === "api" || exampleStep.kind === "app") &&
        exampleStep.body !== undefined,
    );
    return [
      "mod sendmock;",
      "",
      ...(usesJson ? ["use serde_json::json;"] : []),
      `use sendmock::{call, ${usesAppCalls(codeExample) ? "APP, " : ""}SENDMOCK};`,
      "",
      "#[tokio::test]",
      `async fn ${toSnakeWords(codeExample.testName)}() {`,
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "    "),
      "}",
    ].join("\n");
  },
};
