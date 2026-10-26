import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import {
  cliReferenceFilePath,
  mcpToolsFilePath,
  renderApiFiles,
} from "../../scripts/build-openapi";
import { buildCliReference } from "../../scripts/surfaces/reference/build-cli-reference";
import type { CatalogueOperation } from "../../scripts/surfaces/reference/catalogue-operations";
import {
  buildFlagName,
  describeInputShape,
  toSingular,
} from "../../scripts/surfaces/reference/input-naming";
import type {
  CliReference,
  McpReference,
} from "../../scripts/surfaces/reference/reference-types";

let renderedApiFiles: ReturnType<typeof renderApiFiles>;

beforeAll(() => {
  renderedApiFiles = renderApiFiles();
}, 60_000);

function readCommittedJson<ParsedJson>(filePath: string): ParsedJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as ParsedJson;
}

function buildFakeOperation(
  surfaces: Partial<CatalogueOperation["surfaces"]>,
  inputs: CatalogueOperation["inputs"],
): CatalogueOperation {
  return {
    entry: {
      method: "POST",
      path: "/api/v1/things",
      operation: {
        operationId: "postThings",
        summary: "Make a thing.",
        tags: ["Things"],
        responses: { "200": {} },
      },
    },
    surfaces: {
      cli: "sendmock thing create",
      mcp: "sendmock_thing_create",
      ui: "Things",
      ...surfaces,
    },
    inputs,
  };
}

describe("CLI and MCP references (WS-07.5)", () => {
  test("WS-07.5 the committed references equal a fresh build from the spec and the catalogue", () => {
    for (const filePath of [cliReferenceFilePath, mcpToolsFilePath]) {
      expect(
        readFileSync(filePath, "utf8") ===
          renderedApiFiles.renderedFiles.get(filePath),
      ).toBe(true);
    }
  });

  test("WS-07.5 the rules find no flag or property clashes and every override names a real input", () => {
    expect(renderedApiFiles.problems).toEqual([]);
  });

  test("WS-07.5 every catalogue command and tool has an entry", () => {
    const cliReference = readCommittedJson<CliReference>(cliReferenceFilePath);
    const mcpReference = readCommittedJson<McpReference>(mcpToolsFilePath);
    const catalogueEntries = Object.values(surfaceCatalogue);
    const catalogueTools = catalogueEntries.flatMap((surfaces) =>
      surfaces.mcp === null || surfaces.mcp.startsWith("sendmock://")
        ? []
        : [surfaces.mcp],
    );

    expect(
      new Set(
        cliReference.commands.flatMap((command) =>
          command.operations.map(
            (operation) => `${operation.method} ${operation.path}`,
          ),
        ),
      ).size,
    ).toBe(catalogueEntries.length);
    expect(mcpReference.tools.map((tool) => tool.name).sort()).toEqual(
      [...new Set(catalogueTools)].sort(),
    );
    expect(mcpReference.exemptions).toHaveLength(2);
  });

  test("WS-07.5 flags follow the naming rules", () => {
    const booleanShape = describeInputShape({ type: "boolean" }, {});
    const listShape = describeInputShape(
      { type: "array", items: { type: "string" } },
      {},
    );
    const scalarShape = describeInputShape({ type: "string" }, {});

    expect(buildFlagName("is_read", booleanShape)).toBe("--read");
    expect(buildFlagName("has_attachment", booleanShape)).toBe(
      "--has-attachment",
    );
    expect(buildFlagName("tags", listShape)).toBe("--tag");
    expect(buildFlagName("bounce_type", scalarShape)).toBe("--bounce-type");
    expect(buildFlagName("emailId", scalarShape)).toBe("--email-id");
    expect(toSingular("policies")).toBe("policy");
    expect(toSingular("address")).toBe("address");
  });

  test("WS-07.5 two inputs on one flag, and an override naming no input, are reported", () => {
    const clashingOperation = buildFakeOperation({}, [
      {
        name: "tag",
        location: "query",
        schema: { type: "string" },
        isRequired: false,
        description: "A tag.",
        example: "a",
      },
      {
        name: "tags",
        location: "body",
        schema: { type: "array", items: { type: "string" } },
        isRequired: false,
        description: "Tags.",
        example: ["a"],
      },
    ]);
    const overrideOperation = buildFakeOperation(
      { cli: "sendmock thing other", cliFlags: { colour: "--color" } },
      [],
    );

    const { problems } = buildCliReference(
      [clashingOperation, overrideOperation],
      {},
    );

    expect(problems).toEqual([
      "sendmock thing create: tag and tags both map to --tag",
      "sendmock thing other: the override names colour, which is not an input",
    ]);
  });
});
