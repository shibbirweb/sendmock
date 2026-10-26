/** What every language renderer of the code examples shares. */
import type { ExampleContract } from "./example-contract";
import { resolveContractSchema } from "./example-contract";
import type { CodeExample, ExampleStep } from "./example-types";

/** Each language turns an example into one test file's worth of code. */
export type ExampleRenderer = {
  /** The tab title, e.g. `PHP`. */
  tabName: string;
  /** The code fence language, e.g. `php`. */
  fenceLanguage: string;
  render: (
    codeExample: CodeExample,
    exampleContract: ExampleContract,
  ) => string;
};

/** Whether a named answer is a JSON object or a list, for typed languages. */
export function readAnswerKinds(
  codeExample: CodeExample,
  exampleContract: ExampleContract,
): Map<string, "object" | "list"> {
  const answerKinds = new Map<string, "object" | "list">();
  for (const exampleStep of codeExample.steps) {
    if (exampleStep.kind !== "api" || exampleStep.answerName === undefined) {
      continue;
    }
    const responseSchema = exampleContract.findOperation(
      exampleStep.method,
      exampleStep.path,
    )?.responseSchema;
    const resolvedSchema = responseSchema
      ? resolveContractSchema(responseSchema, exampleContract.schemas)
      : {};
    answerKinds.set(
      exampleStep.answerName,
      resolvedSchema.type === "array" ? "list" : "object",
    );
  }

  return answerKinds;
}

/** The steps' lines with a blank line between steps; checks at the end stay together. */
export function joinStepLines(
  steps: ExampleStep[],
  renderStep: (exampleStep: ExampleStep) => string[],
): string[] {
  return steps.flatMap((exampleStep, stepIndex) => {
    const isAfterCheck =
      stepIndex > 0 &&
      exampleStep.kind === "expect" &&
      steps[stepIndex - 1]?.kind === "expect";
    return [
      ...(stepIndex === 0 || isAfterCheck ? [] : [""]),
      // A step can return lines that hold line breaks (a map laid out over lines).
      ...renderStep(exampleStep).flatMap((stepLine) => stepLine.split("\n")),
    ];
  });
}

export function indentLines(lines: string[], indent: string): string[] {
  return lines.map((line) => (line === "" ? "" : `${indent}${line}`));
}

/** `read-a-code` or `read a code` to `ReadACode`. */
export function toPascalCase(words: string): string {
  return words
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== "")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/** `recipes/read-a-code.md` to `read-a-code`; `mail/index.md` to `mail`. */
export function readPageSlug(page: string): string {
  const pageParts = page.replace(/\.md$/, "").split("/");
  const lastPart = pageParts.at(-1) ?? "example";

  return lastPart === "index" ? (pageParts.at(-2) ?? "example") : lastPart;
}

/** A double-quoted string literal with JSON escapes (JavaScript, Go, Java, C#, Rust, Python). */
export function quoteDouble(text: string): string {
  return JSON.stringify(text);
}

/** Whether the example calls the reader's app, so the app's base URL is imported. */
export function usesAppCalls(codeExample: CodeExample): boolean {
  return codeExample.steps.some((exampleStep) => exampleStep.kind === "app");
}

/** Whether the example checks a field, so the assertion helpers are imported. */
export function hasChecks(codeExample: CodeExample): boolean {
  return codeExample.steps.some((exampleStep) => exampleStep.kind === "expect");
}

/** Inline entries longer than this go one per line. */
const maxInlineLength = 60;

/**
 * A map or list literal: inline when short, else one entry per line.
 * `indent` is the indent of the line the literal starts on.
 */
export function layoutEntries(layout: {
  open: string;
  close: string;
  entries: string[];
  indent: string;
  indentUnit: string;
  /** `{ a }` rather than `{a}` when inline. */
  hasInlinePadding?: boolean;
  hasTrailingComma: boolean;
  /** The opening when broken over lines, e.g. `new\n{` in C#. */
  multilineOpen?: string;
  /** Entries for the broken form, e.g. with Go's aligned values. */
  multilineEntries?: string[];
}): string {
  const padding = layout.hasInlinePadding ? " " : "";
  const inline = `${layout.open}${padding}${layout.entries.join(", ")}${padding}${layout.close}`;
  if (inline.length <= maxInlineLength && !inline.includes("\n")) {
    return inline;
  }
  const lineEntries = layout.multilineEntries ?? layout.entries;
  const entryLines = lineEntries.map((entry, entryIndex) => {
    const isLast = entryIndex === lineEntries.length - 1;
    return `${layout.indent}${layout.indentUnit}${entry}${layout.hasTrailingComma || !isLast ? "," : ""}`;
  });

  return [
    layout.multilineOpen ?? layout.open,
    ...entryLines,
    `${layout.indent}${layout.close}`,
  ].join("\n");
}
