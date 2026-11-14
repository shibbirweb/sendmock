/**
 * A tool's `inputSchema`: self-contained JSON Schema, with the API types it
 * uses copied into `$defs` (docs/plan/21-reference-and-examples.md).
 */
import type { CatalogueOperation } from "./catalogue-operations";
import type { McpProperty, McpTool } from "./reference-types";
import { readComponentName, type SpecSchema } from "./spec-reader";

type Schemas = Record<string, SpecSchema>;

/** Points `#/components/schemas/X` at `#/$defs/X` and notes each X. */
function rewriteForDefs(schemaNode: unknown, usedNames: Set<string>): unknown {
  if (Array.isArray(schemaNode)) {
    return schemaNode.map((item) => rewriteForDefs(item, usedNames));
  }
  if (schemaNode === null || typeof schemaNode !== "object") {
    return schemaNode;
  }
  const componentName = readComponentName(schemaNode as SpecSchema);
  if (componentName !== null) {
    usedNames.add(componentName);
  }

  return Object.fromEntries(
    Object.entries(schemaNode).map(([propertyName, propertyValue]) =>
      propertyName === "$ref" && componentName !== null
        ? [propertyName, `#/$defs/${componentName}`]
        : [propertyName, rewriteForDefs(propertyValue, usedNames)],
    ),
  );
}

/** The used types and every type they use in turn. */
function collectDefs(
  usedNames: Set<string>,
  schemas: Schemas,
): Record<string, SpecSchema> {
  const defs: Record<string, SpecSchema> = {};
  const pendingNames = [...usedNames];
  while (pendingNames.length > 0) {
    const componentName = pendingNames.pop() ?? "";
    if (componentName in defs) {
      continue;
    }
    const nestedNames = new Set<string>();
    defs[componentName] = rewriteForDefs(
      schemas[componentName] ?? {},
      nestedNames,
    ) as SpecSchema;
    pendingNames.push(...nestedNames);
  }

  return Object.fromEntries(
    Object.entries(defs).sort(([firstName], [secondName]) =>
      firstName.localeCompare(secondName),
    ),
  );
}

function findInputSchema(
  property: McpProperty,
  operationGroup: CatalogueOperation[],
): SpecSchema {
  if (property.input === null) {
    return { type: "string", enum: property.allowed_values ?? [] };
  }
  if (property.input.location === "raw_body") {
    return { type: "string" };
  }
  const matchingInput = operationGroup
    .flatMap((catalogueOperation) => catalogueOperation.inputs)
    .find(
      (input) =>
        input.name === property.input?.name &&
        input.location === property.input.location,
    );

  return matchingInput?.schema ?? {};
}

export function buildToolInputSchema(
  toolProperties: McpProperty[],
  operationGroup: CatalogueOperation[],
  schemas: Schemas,
): McpTool["input_schema"] {
  const usedNames = new Set<string>();
  const properties = Object.fromEntries(
    toolProperties.map((property) => {
      const inputSchema = rewriteForDefs(
        findInputSchema(property, operationGroup),
        usedNames,
      ) as SpecSchema;
      return [
        property.name,
        {
          ...inputSchema,
          description: property.description,
          ...(property.example === undefined
            ? {}
            : { examples: [property.example] }),
        },
      ];
    }),
  );
  const requiredNames = toolProperties
    .filter((property) => property.is_required)
    .map((property) => property.name);
  const defs = collectDefs(usedNames, schemas);

  return {
    type: "object",
    properties,
    ...(requiredNames.length > 0 ? { required: requiredNames } : {}),
    ...(Object.keys(defs).length > 0 ? { $defs: defs } : {}),
  };
}
