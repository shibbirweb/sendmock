/**
 * The CLI command and MCP call for the request in the playground form
 * (docs/plan/21-reference-and-examples.md, WS-04.6), from the generated
 * CLI and MCP references.
 */

/** Where a value goes: a path or query parameter, a body field or the raw body. */
export type SnippetInput = { name: string; location: string } | null;

export type CliSnippetSource = {
  /** `sendmock email update <emailId> [flags]`. */
  usage: string;
  url: string;
  arguments: {
    name: string;
    input: SnippetInput;
    example: unknown;
    reads_file: boolean;
  }[];
  flags: {
    flag: string;
    input: SnippetInput;
    value_label: string | null;
    is_repeatable: boolean;
    takes_json: boolean;
    example: unknown;
  }[];
  /** The value that picks this operation when the command runs several. */
  selectorValue: string | null;
};

export type McpSnippetSource =
  | {
      kind: "tool";
      name: string;
      url: string;
      properties: { name: string; input: SnippetInput; type: string }[];
      selectorValue: string | null;
    }
  | { kind: "resource"; uri: string; url: string };

/** What the form holds: path and query values, the body as parsed JSON, or raw text. */
export type SnippetFormValues = {
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  /** The parsed JSON body; undefined when the body is not JSON or does not parse. */
  bodyObject: Record<string, unknown> | undefined;
  rawBody: string | null;
};

const longCommandLength = 80;

function quoteShellValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);

  return /^[\w@.+:/=,%-]+$/.test(text)
    ? text
    : `'${text.replace(/'/g, `'\\''`)}'`;
}

function readFormValue(
  input: SnippetInput,
  formValues: SnippetFormValues,
): unknown {
  if (input === null) {
    return undefined;
  }
  if (input.location === "path") {
    return formValues.pathValues[input.name] || undefined;
  }
  if (input.location === "query") {
    return formValues.queryValues[input.name] || undefined;
  }
  if (input.location === "raw_body") {
    return formValues.rawBody || undefined;
  }

  return formValues.bodyObject?.[input.name];
}

function renderFlag(
  flag: CliSnippetSource["flags"][number],
  value: unknown,
): string[] {
  if (flag.value_label === null) {
    const isOn = value === true || value === "true";
    return [isOn ? flag.flag : flag.flag.replace(/^--/, "--no-")];
  }
  if (flag.is_repeatable && Array.isArray(value)) {
    return value.flatMap((item) => [flag.flag, quoteShellValue(item)]);
  }

  return [
    flag.flag,
    quoteShellValue(flag.takes_json ? JSON.stringify(value) : value),
  ];
}

/** The command's own words, with its arguments and inline flags filled in. */
function renderCommandWords(
  source: CliSnippetSource,
  formValues: SnippetFormValues,
  usedFlags: Set<string>,
): string[] {
  const commandWords = source.usage.replace(/ \[flags\]$/, "").split(" ");
  return commandWords.map((commandWord, wordIndex) => {
    if (commandWord.startsWith("--")) {
      usedFlags.add(commandWord);
      return commandWord;
    }
    if (!commandWord.startsWith("<")) {
      return commandWord;
    }
    const commandArgument = source.arguments.find(
      (argument) => `<${argument.name}>` === commandWord,
    );
    const inlineFlag = source.flags.find(
      (flag) =>
        flag.flag === commandWords[wordIndex - 1] &&
        flag.value_label === commandWord,
    );
    const value = commandArgument?.reads_file
      ? commandArgument.example
      : readFormValue(
          commandArgument?.input ?? inlineFlag?.input ?? null,
          formValues,
        );
    return value === undefined ? commandWord : quoteShellValue(value);
  });
}

export function buildCliSnippet(
  source: CliSnippetSource,
  formValues: SnippetFormValues,
): string {
  const usedFlags = new Set<string>();
  const commandWords = renderCommandWords(source, formValues, usedFlags);
  const flagParts = source.flags
    .filter((flag) => !usedFlags.has(flag.flag))
    .flatMap((flag) => {
      if (flag.input === null) {
        if (flag.value_label === null) {
          return flag.flag === "--yes" ? [[flag.flag]] : [];
        }
        return source.selectorValue === null
          ? []
          : [[flag.flag, quoteShellValue(source.selectorValue)]];
      }
      if (flag.input.location === "raw_body") {
        return formValues.rawBody
          ? [[flag.flag, quoteShellValue(flag.example)]]
          : [];
      }
      const value = readFormValue(flag.input, formValues);
      return value === undefined || value === null
        ? []
        : [renderFlag(flag, value)];
    });
  const singleLine = [...commandWords, ...flagParts.flat()].join(" ");
  if (singleLine.length <= longCommandLength || flagParts.length === 0) {
    return singleLine;
  }

  return [
    commandWords.join(" "),
    ...flagParts.map((flagPart) => `  ${flagPart.join(" ")}`),
  ].join(" \\\n");
}

/** Form text to the type the tool's input schema expects. */
function toTypedValue(value: unknown, typeLabel: string): unknown {
  if (typeof value !== "string") {
    return value;
  }
  if (typeLabel === "integer" || typeLabel === "number") {
    return Number.isNaN(Number(value)) ? value : Number(value);
  }
  if (typeLabel === "boolean") {
    return value === "true";
  }

  return value;
}

export function buildMcpSnippet(
  source: McpSnippetSource,
  formValues: SnippetFormValues,
): string {
  if (source.kind === "resource") {
    const resourceUri = source.uri.replace(
      /\{(\w+)\}/g,
      (placeholder, parameterName: string) =>
        formValues.pathValues[parameterName] || placeholder,
    );
    return JSON.stringify(
      { method: "resources/read", params: { uri: resourceUri } },
      null,
      2,
    );
  }
  const toolArguments = Object.fromEntries(
    source.properties.flatMap((property) => {
      const value =
        property.input === null
          ? (source.selectorValue ?? undefined)
          : readFormValue(property.input, formValues);
      return value === undefined
        ? []
        : [[property.name, toTypedValue(value, property.type)]];
    }),
  );

  return JSON.stringify(
    { name: source.name, arguments: toolArguments },
    null,
    2,
  );
}
