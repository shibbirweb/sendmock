import {
  type AppEventType,
  appEventTypes,
  type HttpMethod,
} from "@/lib/api/types";

/** A template read from an export file (WH-09.3). */
export type ParsedTemplateFile = {
  id: string | null;
  name: string;
  service: string;
  events: AppEventType[];
  variables: string[];
  editsBuiltin: boolean;
  method: HttpMethod;
  contentType: string;
  headers: Record<string, string>;
  body: string;
};

type ParseOutcome =
  { parsedTemplate: ParsedTemplateFile } | { parseError: string };
type TomlSections = Record<string, Record<string, unknown>>;

const multilineLiteralStart = "'''";

/** The small TOML subset the export writes: strings, arrays, booleans, two tables. */
function parseExportToml(fileText: string): TomlSections {
  const tomlSections: TomlSections = { "": {} };
  let currentSection = "";
  const fileLines = fileText.split("\n");
  for (let lineIndex = 0; lineIndex < fileLines.length; lineIndex += 1) {
    const trimmedLine = (fileLines[lineIndex] ?? "").trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const sectionMatch = /^\[([a-z.]+)\]$/.exec(trimmedLine);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[1] ?? "";
      tomlSections[currentSection] = {};
      continue;
    }

    const keyValueMatch =
      /^("(?:[^"\\]|\\.)*"|[A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(trimmedLine);
    if (keyValueMatch === null) {
      throw new Error(`Line ${lineIndex + 1} is not "key = value"`);
    }

    const rawKey = keyValueMatch[1] ?? "";
    const tableKey = rawKey.startsWith('"')
      ? (JSON.parse(rawKey) as string)
      : rawKey;
    const valueText = keyValueMatch[2] ?? "";
    const currentTable = tomlSections[currentSection] ?? {};
    if (valueText === multilineLiteralStart) {
      const bodyLines: string[] = [];
      lineIndex += 1;
      while (
        lineIndex < fileLines.length &&
        (fileLines[lineIndex] ?? "") !== multilineLiteralStart
      ) {
        bodyLines.push(fileLines[lineIndex] ?? "");
        lineIndex += 1;
      }
      currentTable[tableKey] = bodyLines.join("\n");
    } else {
      currentTable[tableKey] = JSON.parse(valueText) as unknown;
    }
    tomlSections[currentSection] = currentTable;
  }

  return tomlSections;
}

/** The same keys as the TOML, as JSON: `{ "name": ..., "request": { ... } }`. */
function readJsonSections(fileText: string): TomlSections {
  const { request: requestTable = {}, ...topLevel } = JSON.parse(
    fileText,
  ) as Record<string, unknown> & {
    request?: Record<string, unknown> & { headers?: Record<string, unknown> };
  };
  const { headers: headerTable = {}, ...requestFields } = requestTable;

  return {
    "": topLevel,
    request: requestFields,
    "request.headers": headerTable,
  };
}

function readText(
  table: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = table?.[key];

  return typeof value === "string" ? value : null;
}

function readTextList(
  table: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = table?.[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Reads an exported template file, TOML or JSON, or says why it cannot. */
export function parseTemplateFile(fileText: string): ParseOutcome {
  let tomlSections: TomlSections;
  try {
    tomlSections = fileText.trim().startsWith("{")
      ? readJsonSections(fileText)
      : parseExportToml(fileText);
  } catch (parseFailure) {
    return {
      parseError: `The file could not be read: ${parseFailure instanceof Error ? parseFailure.message : "unknown format"}`,
    };
  }

  const topLevel = tomlSections[""];
  const requestTable = tomlSections.request;
  const name = readText(topLevel, "name");
  const method = readText(requestTable, "method");
  const contentType = readText(requestTable, "content_type");
  const body = readText(requestTable, "body");
  if (
    name === null ||
    method === null ||
    contentType === null ||
    body === null
  ) {
    return {
      parseError:
        "A template needs name, request.method, request.content_type and request.body",
    };
  }

  return {
    parsedTemplate: {
      id: readText(topLevel, "id"),
      name,
      service: readText(topLevel, "service") ?? "Custom",
      events: readTextList(topLevel, "events").filter(
        (eventType): eventType is AppEventType =>
          (appEventTypes as readonly string[]).includes(eventType),
      ),
      variables: readTextList(topLevel, "variables"),
      editsBuiltin: topLevel?.edits_builtin === true,
      method: method as HttpMethod,
      contentType,
      headers: Object.fromEntries(
        Object.entries(tomlSections["request.headers"] ?? {}).filter(
          (headerEntry): headerEntry is [string, string] =>
            typeof headerEntry[1] === "string",
        ),
      ),
      body,
    },
  };
}
