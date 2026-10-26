/**
 * Every field a request accepts, flattened for the playground's Inputs panel
 * (docs/plan/21-reference-and-examples.md, WS-04.4).
 */
import type { JsonSchema, SchemaComponents } from "./openapi-types";
import {
  buildExampleValue,
  readReferenceName,
  resolveSchema,
} from "./schema-tools";

export type SchemaField = {
  /** `retry_policy.max_attempts`, `steps[].type`. */
  path: string;
  name: string;
  /** 0 for a top-level body field; nested fields are indented by it. */
  depth: number;
  typeLabel: string;
  isRequired: boolean;
  description: string;
  allowedValues: unknown[] | null;
  defaultValue: unknown;
  example: unknown;
};

/** Nested objects deeper than this show as one row. */
const maxFieldDepth = 3;

function isNullable(schema: JsonSchema): boolean {
  return (
    (Array.isArray(schema.type) && schema.type.includes("null")) ||
    (schema.anyOf ?? schema.oneOf ?? []).some(
      (variant) => variant.type === "null",
    )
  );
}

/** The schema without its `null` half, references followed. */
function resolveValueSchema(
  schema: JsonSchema,
  schemas: SchemaComponents,
): JsonSchema {
  const resolvedSchema = resolveSchema(schema, schemas);
  const nonNullVariants = (
    resolvedSchema.anyOf ??
    resolvedSchema.oneOf ??
    []
  ).filter((variant) => variant.type !== "null");
  if (nonNullVariants.length === 1 && nonNullVariants[0] !== undefined) {
    return resolveValueSchema(nonNullVariants[0], schemas);
  }

  return resolvedSchema;
}

/** The values a field takes, or null when any value of its type goes. */
export function readAllowedValues(
  schema: JsonSchema,
  schemas: SchemaComponents,
): unknown[] | null {
  const valueSchema = resolveValueSchema(schema, schemas);
  if (valueSchema.enum !== undefined) {
    return valueSchema.enum.filter((allowedValue) => allowedValue !== null);
  }
  if (valueSchema.const !== undefined) {
    return [valueSchema.const];
  }

  return valueSchema.items === undefined
    ? null
    : readAllowedValues(valueSchema.items, schemas);
}

/** `string`, `integer[]`, `RetryPolicy`, `string | null`. */
export function describeFieldType(
  schema: JsonSchema,
  schemas: SchemaComponents,
): string {
  const valueSchema = resolveValueSchema(schema, schemas);
  const nullSuffix =
    isNullable(resolveSchema(schema, schemas)) || isNullable(schema)
      ? " | null"
      : "";
  if (valueSchema.enum !== undefined || valueSchema.const !== undefined) {
    const firstValue =
      valueSchema.enum?.find((allowedValue) => allowedValue !== null) ??
      valueSchema.const;
    return `${typeof firstValue === "number" ? "number" : "string"}${nullSuffix}`;
  }
  if (valueSchema.items !== undefined) {
    return `${describeFieldType(valueSchema.items, schemas)}[]${nullSuffix}`;
  }
  if (
    valueSchema.properties !== undefined ||
    (valueSchema.anyOf ?? valueSchema.oneOf) !== undefined
  ) {
    const referenceName =
      readReferenceName(schema) ?? readReferenceName(valueSchema);
    return `${referenceName ?? "object"}${nullSuffix}`;
  }
  const typeName =
    [valueSchema.type].flat().find((name) => name !== "null") ?? "object";

  return `${typeName}${nullSuffix}`;
}

function collectFields(
  objectSchema: JsonSchema,
  schemas: SchemaComponents,
  pathPrefix: string,
  depth: number,
  fields: SchemaField[],
): void {
  const requiredNames = new Set(objectSchema.required ?? []);
  for (const [propertyName, propertySchema] of Object.entries(
    objectSchema.properties ?? {},
  )) {
    const fieldPath = `${pathPrefix}${propertyName}`;
    fields.push({
      path: fieldPath,
      name: propertyName,
      depth,
      typeLabel: describeFieldType(propertySchema, schemas),
      isRequired: requiredNames.has(propertyName),
      description:
        propertySchema.description ??
        resolveSchema(propertySchema, schemas).description ??
        "",
      allowedValues: readAllowedValues(propertySchema, schemas),
      defaultValue: propertySchema.default,
      example: buildExampleValue(propertySchema, schemas),
    });
    if (depth + 1 >= maxFieldDepth) {
      continue;
    }
    const valueSchema = resolveValueSchema(propertySchema, schemas);
    if (valueSchema.properties !== undefined) {
      collectFields(valueSchema, schemas, `${fieldPath}.`, depth + 1, fields);
    } else if (valueSchema.items !== undefined) {
      const itemSchema = resolveValueSchema(valueSchema.items, schemas);
      if (itemSchema.properties !== undefined) {
        collectFields(
          itemSchema,
          schemas,
          `${fieldPath}[].`,
          depth + 1,
          fields,
        );
      }
    }
  }
}

/** The body's fields, nested ones after their parent; empty for a non-object body. */
export function listSchemaFields(
  schema: JsonSchema,
  schemas: SchemaComponents,
): SchemaField[] {
  const fields: SchemaField[] = [];
  collectFields(resolveValueSchema(schema, schemas), schemas, "", 0, fields);

  return fields;
}
