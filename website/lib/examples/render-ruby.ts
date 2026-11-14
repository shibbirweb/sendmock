/** The Ruby tab: an RSpec example with the `call` helper from the Ruby Connect page. */
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
  readPageSlug,
  layoutEntries,
} from "./render-shared";

/** A double-quoted Ruby string; `#{` is escaped so it is not interpolated. */
function quoteRuby(text: string): string {
  return JSON.stringify(text).replace(/#\{/g, "\\#{");
}

function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number"
        ? `[${pathPart}]`
        : `[${quoteRuby(pathPart)}]`,
    )
    .join("")}`;
}

function renderRubyValue(stepValue: StepValue, indent = ""): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quoteRuby(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  const childIndent = `${indent}  `;
  if (Array.isArray(stepValue)) {
    return layoutEntries({
      open: "[",
      close: "]",
      entries: stepValue.map((item) => renderRubyValue(item, childIndent)),
      indent,
      indentUnit: "  ",
      hasTrailingComma: true,
    });
  }
  return layoutEntries({
    open: "{",
    close: "}",
    entries: Object.entries(stepValue).map(
      ([key, value]) =>
        `${quoteRuby(key)} => ${renderRubyValue(value, childIndent)}`,
    ),
    indent,
    indentUnit: "  ",
    hasInlinePadding: true,
    hasTrailingComma: true,
  });
}

function renderUrl(apiStep: ApiStep): string {
  const pathText = splitApiPath(apiStep)
    .map((pathPart) => {
      if (pathPart.kind === "text") {
        return pathPart.text;
      }
      return isFieldReference(pathPart.value)
        ? `#{${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}}`
        : String(pathPart.value);
    })
    .join("");

  return `"#{SENDMOCK}${pathText}${buildQueryString(apiStep.query)}"`;
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)}`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? ""
        : `, ${renderRubyValue(exampleStep.body)}`;
    return [
      `call(${quoteRuby(exampleStep.method)}, "#{APP}${exampleStep.path}"${bodyText})`,
    ];
  }
  if (exampleStep.kind === "expect") {
    return [
      `expect(${renderReference(exampleStep.answerName, exampleStep.fieldPath)}).to eq(${JSON.stringify(exampleStep.value)})`,
    ];
  }
  const bodyText =
    exampleStep.body === undefined
      ? ""
      : `, ${renderRubyValue(exampleStep.body)}`;
  const callText = `call(${quoteRuby(exampleStep.method)}, ${renderUrl(exampleStep)}${bodyText})`;

  return [
    exampleStep.answerName === undefined
      ? callText
      : `${exampleStep.answerName} = ${callText}`,
  ];
}

export const rubyRenderer: ExampleRenderer = {
  tabName: "Ruby",
  fenceLanguage: "ruby",
  render: (codeExample: CodeExample) => {
    const suiteName = readPageSlug(codeExample.page).replace(/-/g, " ");
    return [
      'require_relative "sendmock_helper"',
      "",
      `RSpec.describe ${quoteRuby(suiteName.charAt(0).toUpperCase() + suiteName.slice(1))} do`,
      `  it ${quoteRuby(codeExample.testName)} do`,
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "    "),
      "  end",
      "end",
    ].join("\n");
  },
};
