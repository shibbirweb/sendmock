import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createGenerator } from "ts-json-schema-generator";

import type { ApiEndpoint } from "../../src/lib/api/endpoint-registry";
import { buildSchemaEntrySource } from "./schema-roots";

export type JsonSchema = Record<string, unknown>;

/** `PageOf<EmailSummary>` is not a valid component name; `PageOf_EmailSummary` is. */
export function toComponentName(definitionName: string): string {
  return decodeURIComponent(definitionName)
    .replace(/[<,]\s*/g, "_")
    .replace(/[>\s]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Points every `#/definitions/...` reference at `#/components/schemas/...`. */
function rewriteReferences(schemaNode: unknown): unknown {
  if (Array.isArray(schemaNode)) {
    return schemaNode.map(rewriteReferences);
  }
  if (schemaNode === null || typeof schemaNode !== "object") {
    return schemaNode;
  }

  return Object.fromEntries(
    Object.entries(schemaNode).map(([propertyName, propertyValue]) => {
      if (propertyName === "$ref" && typeof propertyValue === "string") {
        const definitionName = propertyValue.replace("#/definitions/", "");
        return [
          propertyName,
          `#/components/schemas/${toComponentName(definitionName)}`,
        ];
      }
      return [propertyName, rewriteReferences(propertyValue)];
    }),
  );
}

/**
 * JSON Schemas for every API type the endpoints name, generated from
 * `src/lib/api/types` with ts-json-schema-generator, keyed by component name.
 */
export function generateComponentSchemas(
  apiEndpoints: ApiEndpoint[],
  webDirectory: string,
): Record<string, JsonSchema> {
  const cacheDirectory = join(webDirectory, "node_modules/.cache/openapi");
  const entryPath = join(cacheDirectory, "schema-entry.ts");
  const { entrySource, rootTypeName } = buildSchemaEntrySource(
    apiEndpoints,
    join(webDirectory, "src/lib/api/types/index"),
    ["ApiErrorBody"],
  );
  mkdirSync(cacheDirectory, { recursive: true });
  writeFileSync(entryPath, entrySource);

  const schemaGenerator = createGenerator({
    path: entryPath,
    tsconfig: join(webDirectory, "tsconfig.app.json"),
    type: rootTypeName,
    expose: "export",
    topRef: true,
    jsDoc: "basic",
    // Objects stay open, so adding a field later is not a breaking change.
    additionalProperties: true,
    skipTypeCheck: true,
    sortProps: true,
  });
  const generatedSchema = schemaGenerator.createSchema(rootTypeName);
  const definitions = Object.entries(generatedSchema.definitions ?? {}).filter(
    ([definitionName]) => definitionName !== rootTypeName,
  );

  return Object.fromEntries(
    definitions
      .map(([definitionName, definitionSchema]): [string, JsonSchema] => [
        toComponentName(definitionName),
        rewriteReferences(definitionSchema) as JsonSchema,
      ])
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName)),
  );
}
