/**
 * The rules that turn an operation input into a CLI flag or an MCP property
 * (docs/plan/21-reference-and-examples.md, "One rule set for CLI flags and MCP inputs").
 */
import {
  readComponentName,
  resolveSchema,
  type SpecSchema,
} from "./spec-reader";

/** How an input is passed: one value, a switch, a repeated flag, or JSON. */
export type InputShape = {
  kind: "scalar" | "boolean" | "list" | "object";
  /** e.g. `string`, `integer`, `string[]`, `RetryPolicy`, `object`. */
  typeLabel: string;
  allowedValues: unknown[] | null;
};

function readTypeName(schema: SpecSchema): string {
  if (schema.format === "binary") {
    return "file";
  }

  return (
    [schema.type].flat().find((typeName) => typeName !== "null") ?? "string"
  );
}

function readAllowedValues(schema: SpecSchema): unknown[] | null {
  if (schema.enum !== undefined) {
    return schema.enum.filter((allowedValue) => allowedValue !== null);
  }

  return schema.const === undefined ? null : [schema.const];
}

function isObjectLike(
  schema: SpecSchema,
  schemas: Record<string, SpecSchema>,
): boolean {
  const resolvedSchema = resolveSchema(schema, schemas);
  const variants = resolvedSchema.anyOf ?? resolvedSchema.oneOf ?? [];

  return (
    resolvedSchema.properties !== undefined ||
    resolvedSchema.additionalProperties !== undefined ||
    readTypeName(resolvedSchema) === "object" ||
    variants.some((variant) => isObjectLike(variant, schemas))
  );
}

export function describeInputShape(
  schema: SpecSchema,
  schemas: Record<string, SpecSchema>,
): InputShape {
  const resolvedSchema = resolveSchema(schema, schemas);
  const componentName = readComponentName(schema);
  if (resolvedSchema.items !== undefined) {
    const itemSchema = resolveSchema(resolvedSchema.items, schemas);
    const itemComponentName = readComponentName(resolvedSchema.items);
    if (isObjectLike(resolvedSchema.items, schemas)) {
      return {
        kind: "object",
        typeLabel: `${itemComponentName ?? "object"}[]`,
        allowedValues: null,
      };
    }
    return {
      kind: "list",
      typeLabel: `${readTypeName(itemSchema)}[]`,
      allowedValues: readAllowedValues(itemSchema),
    };
  }
  if (isObjectLike(schema, schemas)) {
    return {
      kind: "object",
      typeLabel: componentName ?? "object",
      allowedValues: null,
    };
  }
  const typeName = readTypeName(resolvedSchema);

  return {
    kind: typeName === "boolean" ? "boolean" : "scalar",
    typeLabel: typeName,
    allowedValues: readAllowedValues(resolvedSchema),
  };
}

/** `emailId` to `email_id`; snake_case stays as it is. */
export function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** `bounce_type` and `bounceType` to `bounce-type`. */
export function toKebabCase(name: string): string {
  return toSnakeCase(name).replace(/_/g, "-");
}

/** `tags` to `tag`, `policies` to `policy`; names without a plural stay. */
export function toSingular(name: string): string {
  if (name.endsWith("ies")) {
    return `${name.slice(0, -3)}y`;
  }
  if (name.endsWith("s") && !name.endsWith("ss")) {
    return name.slice(0, -1);
  }

  return name;
}

/**
 * `--bounce-type`; booleans drop an `is_` prefix (`--read`, `--no-read`),
 * and lists of values take the singular, repeated (`--tag a --tag b`).
 */
export function buildFlagName(
  inputName: string,
  inputShape: InputShape,
): string {
  const snakeName = toSnakeCase(inputName);
  if (inputShape.kind === "boolean") {
    return `--${toKebabCase(snakeName.replace(/^is_/, ""))}`;
  }
  if (inputShape.kind === "list") {
    return `--${toKebabCase(toSingular(snakeName))}`;
  }

  return `--${toKebabCase(snakeName)}`;
}

/** The name of a page section for an area, as the API reference builds it. */
export function toAreaSlug(areaName: string): string {
  return areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
