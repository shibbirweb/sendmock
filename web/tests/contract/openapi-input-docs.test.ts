import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { parse } from "yaml";

import { openApiFilePath } from "../../scripts/build-openapi";

type SchemaNode = {
  $ref?: string;
  const?: unknown;
  enum?: unknown[];
  type?: string | string[];
  description?: string;
  examples?: unknown[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
};

type OperationParameter = {
  name: string;
  in: string;
  description?: string;
  example?: unknown;
};

type OpenApiOperation = {
  operationId: string;
  parameters?: OperationParameter[];
  requestBody?: { content: Record<string, { schema: SchemaNode }> };
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, SchemaNode> };
};

const openApiDocument = parse(
  readFileSync(openApiFilePath, "utf8"),
) as OpenApiDocument;
const componentSchemas = openApiDocument.components.schemas;
const operations = Object.values(openApiDocument.paths).flatMap((pathItem) =>
  Object.values(pathItem),
);

function readComponentName(schemaNode: SchemaNode): string | null {
  return schemaNode.$ref?.replace("#/components/schemas/", "") ?? null;
}

/** Follows references and drops the `null` half of a nullable union. */
function resolveSchema(schemaNode: SchemaNode): SchemaNode {
  const componentName = readComponentName(schemaNode);
  if (componentName !== null) {
    return resolveSchema(componentSchemas[componentName] ?? {});
  }
  const nonNullVariants = (schemaNode.anyOf ?? schemaNode.oneOf ?? []).filter(
    (variant) => variant.type !== "null",
  );
  if (nonNullVariants.length === 1 && nonNullVariants[0] !== undefined) {
    return resolveSchema(nonNullVariants[0]);
  }

  return schemaNode;
}

/** Objects with named fields (or lists of them) get their example from those fields. */
function hasDocumentedChildren(schemaNode: SchemaNode): boolean {
  const resolvedSchema = resolveSchema(schemaNode);
  if (resolvedSchema.properties !== undefined) {
    return true;
  }
  if (resolvedSchema.items !== undefined) {
    return hasDocumentedChildren(resolvedSchema.items);
  }
  const variants = resolvedSchema.anyOf ?? resolvedSchema.oneOf ?? [];

  return variants.length > 1 && variants.every(hasDocumentedChildren);
}

/** A discriminator such as `kind: "stop"` has one value, so it needs no example. */
function hasOneValue(schemaNode: SchemaNode): boolean {
  const resolvedSchema = resolveSchema(schemaNode);

  return (
    resolvedSchema.const !== undefined || resolvedSchema.enum?.length === 1
  );
}

/** Every named object a request body reaches, by component name or path. */
function collectInputObjects(): Map<string, SchemaNode> {
  const inputObjects = new Map<string, SchemaNode>();
  const visit = (schemaNode: unknown, location: string) => {
    if (schemaNode === null || typeof schemaNode !== "object") {
      return;
    }
    const typedNode = schemaNode as SchemaNode;
    const componentName = readComponentName(typedNode);
    if (componentName !== null) {
      if (!inputObjects.has(componentName)) {
        inputObjects.set(componentName, componentSchemas[componentName] ?? {});
        visit(componentSchemas[componentName], componentName);
      }
      return;
    }
    if (typedNode.properties !== undefined && !inputObjects.has(location)) {
      inputObjects.set(location, typedNode);
    }
    for (const [propertyName, propertySchema] of Object.entries(
      typedNode.properties ?? {},
    )) {
      // A map documented with a whole-object example covers its own keys.
      const isDocumentedMap =
        propertySchema.$ref === undefined &&
        (propertySchema.examples ?? []).length > 0;
      if (!isDocumentedMap) {
        visit(propertySchema, `${location}.${propertyName}`);
      }
    }
    visit(typedNode.items, `${location}[]`);
    (typedNode.anyOf ?? typedNode.oneOf ?? []).forEach((variant, index) =>
      visit(variant, `${location}|${index}`),
    );
  };
  for (const operation of operations) {
    for (const mediaType of Object.values(
      operation.requestBody?.content ?? {},
    )) {
      visit(mediaType.schema, operation.operationId);
    }
  }

  return inputObjects;
}

describe("input docs (WS-07.1)", () => {
  test("WS-07.1 descriptions do not show internal requirement IDs", () => {
    const specText = readFileSync(openApiFilePath, "utf8");

    expect(specText.match(/\b[A-Z]{2}-\d{2}(?:\.\d+)?\b/g) ?? []).toEqual([]);
  });

  test("WS-07.1 every path and query parameter has a description and an example", () => {
    const undocumentedParameters = operations.flatMap((operation) =>
      (operation.parameters ?? [])
        .filter(
          (parameter) =>
            (parameter.description ?? "").trim() === "" ||
            parameter.example === undefined,
        )
        .map((parameter) => `${operation.operationId} ${parameter.name}`),
    );

    expect(operations.length).toBeGreaterThan(200);
    expect(undocumentedParameters).toEqual([]);
  });

  test("WS-07.1 every request body field has a description, and every field without fields of its own has an example", () => {
    const inputObjects = collectInputObjects();
    const missingDocs = [...inputObjects].flatMap(
      ([objectName, objectSchema]) =>
        Object.entries(objectSchema.properties ?? {}).flatMap(
          ([propertyName, propertySchema]) => {
            const isMissingDescription =
              (propertySchema.description ?? "").trim() === "";
            const isMissingExample =
              !hasDocumentedChildren(propertySchema) &&
              !hasOneValue(propertySchema) &&
              (propertySchema.examples ?? []).length === 0;
            return [
              ...(isMissingDescription
                ? [`${objectName}.${propertyName}: description`]
                : []),
              ...(isMissingExample
                ? [`${objectName}.${propertyName}: example`]
                : []),
            ];
          },
        ),
    );

    expect(inputObjects.size).toBeGreaterThan(80);
    expect(missingDocs).toEqual([]);
  });
});
