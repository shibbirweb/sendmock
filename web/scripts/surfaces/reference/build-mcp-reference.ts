/**
 * Builds docs/api/mcp-tools.json: every MCP tool with its input schema,
 * annotations, example call and result, plus resources and the exemptions
 * (docs/plan/21-reference-and-examples.md, WS-07.3, WS-07.5).
 */
import { findMcpToolset } from "../../../src/lib/api/surface-catalogue/mcp-toolsets";
import {
  type CatalogueOperation,
  describeGroupOutput,
  groupOperations,
  isDestructiveOperation,
  isReadOnlyOperation,
  pickExampleInputs,
  toReferencedOperation,
} from "./catalogue-operations";
import { describeInputShape, toAreaSlug } from "./input-naming";
import { buildToolInputSchema } from "./mcp-input-schema";
import {
  collectToolProperties,
  readSelectorValue,
  toMcpProperty,
  toMcpPropertyName,
} from "./mcp-properties";
import type {
  McpExemption,
  McpProperty,
  McpReference,
  McpResource,
  McpTool,
} from "./reference-types";
import type { SpecSchema } from "./spec-reader";

type Schemas = Record<string, SpecSchema>;

/** Optional inputs shown in an example call, after the required ones. */
const optionalExampleInputLimit = 2;

function buildExampleArguments(
  firstOperation: CatalogueOperation,
  toolProperties: McpProperty[],
  schemas: Schemas,
): Record<string, unknown> {
  const exampleInputs = pickExampleInputs(
    firstOperation.inputs,
    (input) => describeInputShape(input.schema, schemas).kind !== "object",
    optionalExampleInputLimit,
  );
  const selectorProperty = toolProperties.find(
    (property) => property.input === null,
  );
  return Object.fromEntries([
    ...(selectorProperty === undefined
      ? []
      : [[selectorProperty.name, readSelectorValue(firstOperation)]]),
    ...exampleInputs.map((input) => [toMcpPropertyName(input), input.example]),
  ]);
}

function buildTool(
  toolName: string,
  operationGroup: CatalogueOperation[],
  schemas: Schemas,
  problems: string[],
): McpTool | null {
  const firstOperation = operationGroup[0];
  if (firstOperation === undefined) {
    return null;
  }
  if (
    operationGroup.length > 1 &&
    operationGroup.some(
      (catalogueOperation) =>
        catalogueOperation.surfaces.selector === undefined,
    )
  ) {
    problems.push(
      `${toolName} runs ${operationGroup.length} operations, so each needs a selector`,
    );
  }
  const toolProperties = collectToolProperties(
    operationGroup,
    schemas,
    problems,
  );
  const isReadOnly = operationGroup.every((catalogueOperation) =>
    isReadOnlyOperation(catalogueOperation.entry),
  );
  const area = firstOperation.entry.operation.tags[0] ?? "Other";
  return {
    name: toolName,
    toolset: findMcpToolset(toolName),
    summary: [
      ...new Set(
        operationGroup.map(
          (catalogueOperation) => catalogueOperation.entry.operation.summary,
        ),
      ),
    ].join(" "),
    area,
    area_slug: toAreaSlug(area),
    operations: operationGroup.map(toReferencedOperation),
    aliases: [
      ...new Set(
        operationGroup.flatMap(
          (catalogueOperation) => catalogueOperation.surfaces.mcpAliases ?? [],
        ),
      ),
    ],
    annotations: {
      read_only_hint: isReadOnly,
      destructive_hint: operationGroup.some(isDestructiveOperation),
      idempotent_hint:
        !isReadOnly &&
        operationGroup.every((catalogueOperation) =>
          ["PUT", "PATCH", "DELETE"].includes(catalogueOperation.entry.method),
        ),
    },
    properties: toolProperties,
    input_schema: buildToolInputSchema(toolProperties, operationGroup, schemas),
    example_arguments: buildExampleArguments(
      firstOperation,
      toolProperties,
      schemas,
    ),
    output: describeGroupOutput(operationGroup),
    cli: [
      ...new Set(
        operationGroup.map(
          (catalogueOperation) => catalogueOperation.surfaces.cli,
        ),
      ),
    ],
    ui: [
      ...new Set(
        operationGroup.map(
          (catalogueOperation) => catalogueOperation.surfaces.ui,
        ),
      ),
    ],
  };
}

function buildResource(
  catalogueOperation: CatalogueOperation,
  schemas: Schemas,
): McpResource {
  const successStatus =
    Object.keys(catalogueOperation.entry.operation.responses).find((status) =>
      /^2/.test(status),
    ) ?? "";
  const area = catalogueOperation.entry.operation.tags[0] ?? "Other";
  return {
    uri: catalogueOperation.surfaces.mcp ?? "",
    summary: catalogueOperation.entry.operation.summary,
    mime_type:
      Object.keys(
        catalogueOperation.entry.operation.responses[successStatus]?.content ??
          {},
      )[0] ?? "application/octet-stream",
    area,
    area_slug: toAreaSlug(area),
    parameters: catalogueOperation.inputs.map((input) => ({
      ...toMcpProperty(input, schemas),
      name: input.name,
    })),
    operation: toReferencedOperation(catalogueOperation),
    cli: catalogueOperation.surfaces.cli,
    ui: catalogueOperation.surfaces.ui,
  };
}

function buildExemption(catalogueOperation: CatalogueOperation): McpExemption {
  return {
    operation: toReferencedOperation(catalogueOperation),
    reason: catalogueOperation.surfaces.mcpExemptReason ?? "",
    cli: catalogueOperation.surfaces.cli,
  };
}

export function buildMcpReference(
  catalogueOperations: CatalogueOperation[],
  schemas: Schemas,
): { mcpReference: McpReference; problems: string[] } {
  const problems: string[] = [];
  const isResource = (catalogueOperation: CatalogueOperation) =>
    catalogueOperation.surfaces.mcp?.startsWith("sendmock://") ?? false;
  const toolGroups = groupOperations(
    catalogueOperations,
    (catalogueOperation) =>
      isResource(catalogueOperation) ? null : catalogueOperation.surfaces.mcp,
  );
  const tools = [...toolGroups]
    .flatMap(
      ([toolName, operationGroup]) =>
        buildTool(toolName, operationGroup, schemas, problems) ?? [],
    )
    .sort((firstTool, secondTool) =>
      firstTool.name.localeCompare(secondTool.name),
    );

  return {
    mcpReference: {
      tools,
      resources: catalogueOperations
        .filter(isResource)
        .map((catalogueOperation) =>
          buildResource(catalogueOperation, schemas),
        ),
      exemptions: catalogueOperations
        .filter(
          (catalogueOperation) => catalogueOperation.surfaces.mcp === null,
        )
        .map(buildExemption),
    },
    problems,
  };
}
