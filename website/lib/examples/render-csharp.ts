/** The C# tab: an xUnit test with the `Call` helper from the .NET Connect page. */
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
  readPageSlug,
  toPascalCase,
  layoutEntries,
} from "./render-shared";

/** C# keywords that need `@` to be a member name of an anonymous object. */
const csharpKeywords = new Set([
  "as",
  "base",
  "bool",
  "case",
  "checked",
  "class",
  "default",
  "do",
  "else",
  "event",
  "false",
  "fixed",
  "for",
  "foreach",
  "if",
  "in",
  "int",
  "is",
  "lock",
  "namespace",
  "new",
  "null",
  "object",
  "operator",
  "out",
  "params",
  "ref",
  "return",
  "static",
  "string",
  "switch",
  "this",
  "true",
  "void",
  "while",
]);

/** `otp.GetProperty("items")[0].GetProperty("status")`. */
function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number"
        ? `[${pathPart}]`
        : `.GetProperty(${quoteDouble(pathPart)})`,
    )
    .join("")}`;
}

function renderMemberName(key: string): string {
  return csharpKeywords.has(key) ? `@${key}` : key;
}

function renderCsharpValue(stepValue: StepValue, indent = ""): string {
  if (isFieldReference(stepValue)) {
    return renderReference(stepValue.answerName, stepValue.fieldPath);
  }
  if (typeof stepValue === "string") {
    return quoteDouble(stepValue);
  }
  if (typeof stepValue !== "object") {
    return String(stepValue);
  }
  const childIndent = `${indent}    `;
  if (Array.isArray(stepValue)) {
    const arrayType = stepValue.every((item) => typeof item === "string")
      ? "new[]"
      : "new object[]";
    return layoutEntries({
      open: `${arrayType} {`,
      close: "}",
      entries: stepValue.map((item) => renderCsharpValue(item, childIndent)),
      indent,
      indentUnit: "    ",
      hasInlinePadding: true,
      hasTrailingComma: true,
      multilineOpen: `${arrayType}\n${indent}{`,
    });
  }
  const entries = Object.entries(stepValue);
  const isAnonymous = entries.every(([key]) => /^[A-Za-z_]\w*$/.test(key));
  const objectType = isAnonymous ? "new" : "new Dictionary<string, object>";
  return layoutEntries({
    open: `${objectType} {`,
    close: "}",
    entries: entries.map(([key, value]) =>
      isAnonymous
        ? `${renderMemberName(key)} = ${renderCsharpValue(value, childIndent)}`
        : `[${quoteDouble(key)}] = ${renderCsharpValue(value, childIndent)}`,
    ),
    indent,
    indentUnit: "    ",
    hasInlinePadding: true,
    hasTrailingComma: true,
    multilineOpen: `${objectType}\n${indent}{`,
  });
}

/** Concatenated, so no quotes sit inside an interpolation hole (older C# rejects them). */
function renderUrl(apiStep: ApiStep): string {
  const urlParts = ["Sendmock"];
  let pendingText = "";
  for (const pathPart of splitApiPath(apiStep)) {
    if (pathPart.kind === "text") {
      pendingText += pathPart.text;
    } else if (isFieldReference(pathPart.value)) {
      urlParts.push(
        quoteDouble(pendingText),
        `${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}.GetString()`,
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

  return urlParts.join(" + ");
}

function renderExpect(
  exampleStep: Extract<ExampleStep, { kind: "expect" }>,
): string {
  const fieldExpression = renderReference(
    exampleStep.answerName,
    exampleStep.fieldPath,
  );
  if (typeof exampleStep.value === "boolean") {
    return `Assert.${exampleStep.value ? "True" : "False"}(${fieldExpression}.GetBoolean());`;
  }
  if (typeof exampleStep.value === "number") {
    return `Assert.Equal(${exampleStep.value}, ${fieldExpression}.GetInt32());`;
  }

  return `Assert.Equal(${quoteDouble(exampleStep.value)}, ${fieldExpression}.GetString());`;
}

function renderStep(exampleStep: ExampleStep): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `var ${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)};`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? ""
        : `, ${renderCsharpValue(exampleStep.body)}`;
    return [
      `await Call(${quoteDouble(exampleStep.method)}, App + ${quoteDouble(exampleStep.path)}${bodyText});`,
    ];
  }
  if (exampleStep.kind === "expect") {
    return [renderExpect(exampleStep)];
  }
  const bodyText =
    exampleStep.body === undefined
      ? ""
      : `, ${renderCsharpValue(exampleStep.body)}`;
  const callText = `await Call(${quoteDouble(exampleStep.method)}, ${renderUrl(exampleStep)}${bodyText});`;

  return [
    exampleStep.answerName === undefined
      ? callText
      : `var ${exampleStep.answerName} = ${callText}`,
  ];
}

export const csharpRenderer: ExampleRenderer = {
  tabName: "C#",
  fenceLanguage: "csharp",
  render: (codeExample: CodeExample) =>
    [
      "using static SendMock;",
      "",
      `public class ${toPascalCase(readPageSlug(codeExample.page))}Tests`,
      "{",
      "    [Fact]",
      `    public async Task ${toPascalCase(codeExample.testName)}()`,
      "    {",
      ...indentLines(joinStepLines(codeExample.steps, renderStep), "        "),
      "    }",
      "}",
    ].join("\n"),
};
