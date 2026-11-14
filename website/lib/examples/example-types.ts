/**
 * Code examples for the user guide, written once as steps and rendered in
 * every supported language (docs/plan/21-reference-and-examples.md, WS-08).
 */

/** A value taken from an earlier SendMock answer: `ref("otp", "code")`. */
export type FieldReference = {
  kind: "reference";
  answerName: string;
  fieldPath: string;
};

export type StepValue =
  | string
  | number
  | boolean
  | FieldReference
  | StepValue[]
  | { [fieldName: string]: StepValue };

/** A call to the reader's own app, e.g. the sign-up that sends a code. */
export type AppStep = {
  kind: "app";
  method: string;
  path: string;
  body?: Record<string, StepValue>;
  /** What the call does in the reader's app, as a comment in the CLI tab. */
  note: string;
};

/** A call to SendMock's REST API; its answer can be named for later steps. */
export type ApiStep = {
  kind: "api";
  method: string;
  /** A spec path, e.g. `/api/v1/emails/{emailId}/simulate`. */
  path: string;
  pathValues?: Record<string, StepValue>;
  query?: Record<string, string>;
  body?: Record<string, StepValue>;
  answerName?: string;
};

/** Checks a field of a named answer, e.g. `otp.channel` is `"email"`. */
export type ExpectStep = {
  kind: "expect";
  answerName: string;
  fieldPath: string;
  value: string | number | boolean;
};

/** Names a part of an earlier answer, e.g. the first item of a list. */
export type PickStep = {
  kind: "pick";
  answerName: string;
  fromAnswer: string;
  fieldPath: string;
};

export type ExampleStep = AppStep | ApiStep | ExpectStep | PickStep;

export type CodeExample = {
  /** The guide page, relative to docs/wiki, e.g. `recipes/read-a-code.md`. */
  page: string;
  /** The section the example fills: `In your code` or `From your code`. */
  heading: "In your code" | "From your code";
  /** One line above the tabs saying what the code does. */
  intro: string;
  /** The test's name in plain words: `signs up with the emailed code`. */
  testName: string;
  steps: ExampleStep[];
};

export function ref(answerName: string, fieldPath: string): FieldReference {
  return { kind: "reference", answerName, fieldPath };
}

export function isFieldReference(value: unknown): value is FieldReference {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FieldReference).kind === "reference"
  );
}

/** `items.0.status` to `["items", 0, "status"]`. */
export function splitFieldPath(fieldPath: string): (string | number)[] {
  return fieldPath
    .split(".")
    .map((pathPart) => (/^\d+$/.test(pathPart) ? Number(pathPart) : pathPart));
}

/** `signs up with the emailed code` to `signsUpWithTheEmailedCode`. */
export function toCamelCase(words: string): string {
  return words
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== "")
    .map((word, wordIndex) =>
      wordIndex === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

/** `signs up with the emailed code` to `signs_up_with_the_emailed_code`. */
export function toSnakeWords(words: string): string {
  return words
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== "")
    .map((word) => word.toLowerCase())
    .join("_");
}

/** The query string for a URL, values encoded: `?to=user%40example.test`. */
export function buildQueryString(
  query: Record<string, string> | undefined,
): string {
  const queryEntries = Object.entries(query ?? {});
  return queryEntries.length === 0
    ? ""
    : `?${queryEntries
        .map(
          ([queryName, queryValue]) =>
            `${queryName}=${encodeURIComponent(queryValue)}`,
        )
        .join("&")}`;
}

/** The path after `/api/v1`, split into literal text and path values. */
export function splitApiPath(
  apiStep: ApiStep,
): ({ kind: "text"; text: string } | { kind: "value"; value: StepValue })[] {
  const relativePath = apiStep.path.replace(/^\/api\/v1/, "");
  return relativePath
    .split(/(\{\w+\})/)
    .filter((pathPart) => pathPart !== "")
    .map((pathPart) => {
      const parameterName = /^\{(\w+)\}$/.exec(pathPart)?.[1];
      return parameterName === undefined
        ? { kind: "text" as const, text: pathPart }
        : {
            kind: "value" as const,
            value: apiStep.pathValues?.[parameterName] ?? "",
          };
    });
}
