import type { JsonSchema, SchemaComponents } from "./openapi-types";

export function readReferenceName(schema: JsonSchema): string | null {
  return schema.$ref?.split("/").pop() ?? null;
}

/** Follows `$ref` (and single-entry `allOf`) to the schema it names. */
export function resolveSchema(
  schema: JsonSchema,
  schemas: SchemaComponents,
): JsonSchema {
  const referenceName = readReferenceName(schema);
  if (referenceName !== null) {
    return resolveSchema(schemas[referenceName] ?? {}, schemas);
  }
  if (schema.allOf?.length === 1 && schema.allOf[0]) {
    return resolveSchema(schema.allOf[0], schemas);
  }

  return schema;
}

/** A short type label: `EmailSummary[]`, `string | null`, `"sms" | "email"`. */
export function describeSchemaType(schema: JsonSchema): string {
  const referenceName = readReferenceName(schema);
  if (referenceName !== null) {
    return referenceName;
  }
  if (schema.enum) {
    return schema.enum
      .map((enumValue) => JSON.stringify(enumValue))
      .join(" | ");
  }
  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) {
    return variants.map(describeSchemaType).join(" | ");
  }
  if (schema.type === "array" && schema.items) {
    return `${describeSchemaType(schema.items)}[]`;
  }
  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }
  if (schema.type === "object" && !schema.properties) {
    return "object";
  }

  return schema.type ?? "object";
}

/** Names of the component schemas a schema uses, directly or through others. */
export function collectSchemaNames(
  rootSchemas: JsonSchema[],
  schemas: SchemaComponents,
  collectedNames = new Set<string>(),
): Set<string> {
  const visit = (schemaNode: unknown) => {
    if (Array.isArray(schemaNode)) {
      schemaNode.forEach(visit);
      return;
    }
    if (schemaNode === null || typeof schemaNode !== "object") {
      return;
    }
    const referenceName = readReferenceName(schemaNode as JsonSchema);
    if (referenceName !== null && !collectedNames.has(referenceName)) {
      collectedNames.add(referenceName);
      visit(schemas[referenceName]);
    }
    Object.values(schemaNode).forEach(visit);
  };
  rootSchemas.forEach(visit);

  return collectedNames;
}

/** A plausible request body for the editor: required fields filled in. */
export function buildExampleValue(
  schema: JsonSchema,
  schemas: SchemaComponents,
  depth = 0,
): unknown {
  const resolvedSchema = resolveSchema(schema, schemas);
  if (depth > 6) {
    return null;
  }
  if (resolvedSchema.enum) {
    return resolvedSchema.enum[0];
  }
  if (resolvedSchema.const !== undefined) {
    return resolvedSchema.const;
  }
  const firstVariant = (resolvedSchema.anyOf ?? resolvedSchema.oneOf)?.find(
    (variant) => variant.type !== "null",
  );
  if (firstVariant) {
    return buildExampleValue(firstVariant, schemas, depth + 1);
  }
  const schemaType = Array.isArray(resolvedSchema.type)
    ? resolvedSchema.type.find((typeName) => typeName !== "null")
    : resolvedSchema.type;
  if (schemaType === "array") {
    return resolvedSchema.items
      ? [buildExampleValue(resolvedSchema.items, schemas, depth + 1)]
      : [];
  }
  if (schemaType === "object" || resolvedSchema.properties) {
    const requiredNames = new Set(resolvedSchema.required ?? []);
    return Object.fromEntries(
      Object.entries(resolvedSchema.properties ?? {})
        .filter(([propertyName]) => requiredNames.has(propertyName))
        .map(([propertyName, propertySchema]) => [
          propertyName,
          buildExampleValue(propertySchema, schemas, depth + 1),
        ]),
    );
  }
  const primitiveExamples: Record<string, unknown> = {
    string: "",
    number: 0,
    integer: 0,
    boolean: false,
  };

  return primitiveExamples[schemaType ?? ""] ?? null;
}
