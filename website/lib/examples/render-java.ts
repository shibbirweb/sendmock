/** The Java tab: a JUnit 5 test with the `call` helper (Jackson) from the Java Connect page. */
import {
  type ApiStep,
  buildQueryString,
  type CodeExample,
  type ExampleStep,
  isFieldReference,
  splitApiPath,
  splitFieldPath,
  type StepValue,
  toCamelCase,
} from "./example-types";
import {
  type ExampleRenderer,
  indentLines,
  joinStepLines,
  quoteDouble,
  hasChecks,
  readPageSlug,
  toPascalCase,
  usesAppCalls,
  layoutEntries,
} from "./render-shared";

/** `otp.get("items").get(0).get("status")`. */
function renderReference(answerName: string, fieldPath: string): string {
  return `${answerName}${splitFieldPath(fieldPath)
    .map((pathPart) =>
      typeof pathPart === "number"
        ? `.get(${pathPart})`
        : `.get(${quoteDouble(pathPart)})`,
    )
    .join("")}`;
}

function renderJavaValue(
  stepValue: StepValue,
  usedTypes: Set<string>,
  indent = "",
): string {
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
    usedTypes.add("List");
    return layoutEntries({
      open: "List.of(",
      close: ")",
      entries: stepValue.map((item) =>
        renderJavaValue(item, usedTypes, childIndent),
      ),
      indent,
      indentUnit: "    ",
      hasTrailingComma: false,
    });
  }
  usedTypes.add("Map");
  return layoutEntries({
    open: "Map.of(",
    close: ")",
    entries: Object.entries(stepValue).map(
      ([key, value]) =>
        `${quoteDouble(key)}, ${renderJavaValue(value, usedTypes, childIndent)}`,
    ),
    indent,
    indentUnit: "    ",
    hasTrailingComma: false,
  });
}

function renderUrl(apiStep: ApiStep): string {
  const urlParts = ["SENDMOCK"];
  let pendingText = "";
  for (const pathPart of splitApiPath(apiStep)) {
    if (pathPart.kind === "text") {
      pendingText += pathPart.text;
    } else if (isFieldReference(pathPart.value)) {
      urlParts.push(
        quoteDouble(pendingText),
        `${renderReference(pathPart.value.answerName, pathPart.value.fieldPath)}.asText()`,
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
    return `assertEquals(${exampleStep.value}, ${fieldExpression}.asBoolean());`;
  }
  if (typeof exampleStep.value === "number") {
    return `assertEquals(${exampleStep.value}, ${fieldExpression}.asInt());`;
  }

  return `assertEquals(${quoteDouble(exampleStep.value)}, ${fieldExpression}.asText());`;
}

function renderStep(
  exampleStep: ExampleStep,
  usedTypes: Set<string>,
): string[] {
  if (exampleStep.kind === "pick") {
    return [
      `var ${exampleStep.answerName} = ${renderReference(exampleStep.fromAnswer, exampleStep.fieldPath)};`,
    ];
  }
  if (exampleStep.kind === "app") {
    const bodyText =
      exampleStep.body === undefined
        ? "null"
        : renderJavaValue(exampleStep.body, usedTypes);
    return [
      `call(${quoteDouble(exampleStep.method)}, APP + ${quoteDouble(exampleStep.path)}, ${bodyText});`,
    ];
  }
  if (exampleStep.kind === "expect") {
    return [renderExpect(exampleStep)];
  }
  const bodyText =
    exampleStep.body === undefined
      ? "null"
      : renderJavaValue(exampleStep.body, usedTypes);
  const callText = `call(${quoteDouble(exampleStep.method)}, ${renderUrl(exampleStep)}, ${bodyText});`;

  return [
    exampleStep.answerName === undefined
      ? callText
      : `var ${exampleStep.answerName} = ${callText}`,
  ];
}

export const javaRenderer: ExampleRenderer = {
  tabName: "Java",
  fenceLanguage: "java",
  render: (codeExample: CodeExample) => {
    const usedTypes = new Set<string>();
    const bodyLines = joinStepLines(codeExample.steps, (exampleStep) =>
      renderStep(exampleStep, usedTypes),
    );
    return [
      ...(usesAppCalls(codeExample) ? ["import static app.SendMock.APP;"] : []),
      "import static app.SendMock.SENDMOCK;",
      "import static app.SendMock.call;",
      ...(hasChecks(codeExample)
        ? ["import static org.junit.jupiter.api.Assertions.assertEquals;"]
        : []),
      "",
      ...[...usedTypes]
        .sort()
        .map((typeName) => `import java.util.${typeName};`),
      "import org.junit.jupiter.api.Test;",
      "",
      `class ${toPascalCase(readPageSlug(codeExample.page))}Test {`,
      "    @Test",
      `    void ${toCamelCase(codeExample.testName)}() throws Exception {`,
      ...indentLines(bodyLines, "        "),
      "    }",
      "}",
    ].join("\n");
  },
};
