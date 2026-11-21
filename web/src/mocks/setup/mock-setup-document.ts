import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

import type { SetupFileFormat } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildSeedToml } from "@/mocks/fixtures/seed-toml";

/** A parsed setup file: tables, lists and values, as TOML, JSON and YAML all hold them. */
export type SetupDocument = Record<string, unknown>;

/** The format version this mock writes, as the server does. */
export const currentSetupFormatVersion = 2;

/** The `[sendmock]` header an export starts with. */
function buildSetupHeader(): SetupDocument {
  return {
    format: "sendmock.setup",
    format_version: currentSetupFormatVersion,
    exported_by: "demo",
    exported_at: new Date().toISOString(),
  };
}

/** The mock's configuration as a setup: the seed sections and the saved scenarios. */
export function buildSetupDocument(mockDatabase: MockDatabase): SetupDocument {
  const seedDocument = parseToml(buildSeedToml(mockDatabase)) as SetupDocument;
  const savedScenarios = mockDatabase.savedScenarios.map((savedScenario) => ({
    name: savedScenario.name,
    description: savedScenario.description,
    ...(parseToml(savedScenario.scenario) as SetupDocument),
  }));

  return {
    sendmock: buildSetupHeader(),
    ...seedDocument,
    ...(savedScenarios.length > 0 ? { scenarios: savedScenarios } : {}),
  };
}

/** JSON starts with `{`; anything else is read as TOML, as the mock has no YAML reader. */
export function detectSetupFormat(setupText: string): SetupFileFormat {
  return setupText.trimStart().startsWith("{") ? "json" : "toml";
}

export type SetupReadResult =
  { setupDocument: SetupDocument } | { problem: string; line: number | null };

export function readSetupText(
  setupText: string,
  setupFormat: SetupFileFormat,
): SetupReadResult {
  try {
    if (setupFormat === "json") {
      return { setupDocument: JSON.parse(setupText) as SetupDocument };
    }
    if (setupFormat === "yaml") {
      return {
        problem:
          "The demo reads TOML and JSON setups; YAML works with a running SendMock",
        line: null,
      };
    }

    return { setupDocument: parseToml(setupText) as SetupDocument };
  } catch (readError) {
    const errorLine =
      typeof readError === "object" && readError !== null && "line" in readError
        ? Number(readError.line)
        : null;

    return { problem: String(readError), line: errorLine };
  }
}

export function writeSetupText(
  setupDocument: SetupDocument,
  setupFormat: SetupFileFormat,
): string {
  if (setupFormat === "json") {
    return `${JSON.stringify(setupDocument, null, 2)}\n`;
  }
  if (setupFormat === "yaml") {
    return writeYamlValue(setupDocument, 0);
  }

  return stringifyToml(setupDocument);
}

/** A small YAML writer for the values a setup holds: tables, lists, text, numbers and booleans. */
function writeYamlValue(yamlValue: unknown, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  if (Array.isArray(yamlValue)) {
    return yamlValue
      .map((listItem) => {
        const itemText = writeYamlValue(listItem, indentLevel + 1).trimStart();

        return `${indent}- ${itemText}`;
      })
      .join("");
  }
  if (typeof yamlValue === "object" && yamlValue !== null) {
    return Object.entries(yamlValue)
      .map(([entryName, entryValue]) => {
        const isNested =
          typeof entryValue === "object" &&
          entryValue !== null &&
          !(Array.isArray(entryValue) && entryValue.length === 0);

        return isNested
          ? `${indent}${entryName}:\n${writeYamlValue(entryValue, indentLevel + 1)}`
          : `${indent}${entryName}: ${writeYamlScalar(entryValue)}\n`;
      })
      .join("");
  }

  return `${indent}${writeYamlScalar(yamlValue)}\n`;
}

function writeYamlScalar(scalarValue: unknown): string {
  if (Array.isArray(scalarValue)) {
    return "[]";
  }

  return typeof scalarValue === "string"
    ? JSON.stringify(scalarValue)
    : String(scalarValue);
}
