/**
 * Reads the generated OpenAPI document for the CLI and MCP references
 * (docs/plan/21-reference-and-examples.md): operations, their inputs and
 * the schemas behind them.
 */

export type SpecSchema = {
  $ref?: string;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  format?: string;
  description?: string;
  examples?: unknown[];
  default?: unknown;
  properties?: Record<string, SpecSchema>;
  required?: string[];
  items?: SpecSchema;
  additionalProperties?: boolean | SpecSchema;
  anyOf?: SpecSchema[];
  oneOf?: SpecSchema[];
};

type SpecParameter = {
  name: string;
  in: "path" | "query";
  required?: boolean;
  description?: string;
  schema: SpecSchema;
  example?: unknown;
};

type SpecMediaTypes = Record<string, { schema: SpecSchema }>;

export type SpecOperation = {
  operationId: string;
  summary: string;
  tags: string[];
  parameters?: SpecParameter[];
  requestBody?: { content: SpecMediaTypes };
  responses: Record<string, { $ref?: string; content?: SpecMediaTypes }>;
};

export type SpecDocument = {
  paths: Record<string, Record<string, SpecOperation>>;
  components: { schemas: Record<string, SpecSchema> };
};

/** One operation with its method and path, as the catalogue keys it. */
export type SpecOperationEntry = {
  method: string;
  path: string;
  operation: SpecOperation;
};

export type InputLocation = "path" | "query" | "body" | "raw_body";

/** One value a caller passes: a path or query parameter, a body field, or a raw body. */
export type OperationInput = {
  name: string;
  location: InputLocation;
  schema: SpecSchema;
  isRequired: boolean;
  description: string;
  example: unknown;
  /** For a raw body: its content type, e.g. `message/rfc822`. */
  contentType?: string;
};

export function listSpecOperations(
  specDocument: SpecDocument,
): SpecOperationEntry[] {
  return Object.entries(specDocument.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem).map(([method, operation]) => ({
      method: method.toUpperCase(),
      path,
      operation,
    })),
  );
}

export function readComponentName(schema: SpecSchema): string | null {
  return schema.$ref?.replace("#/components/schemas/", "") ?? null;
}

/** Follows references and drops the `null` half of a nullable union. */
export function resolveSchema(
  schema: SpecSchema,
  schemas: Record<string, SpecSchema>,
): SpecSchema {
  const componentName = readComponentName(schema);
  if (componentName !== null) {
    return resolveSchema(schemas[componentName] ?? {}, schemas);
  }
  const nonNullVariants = (schema.anyOf ?? schema.oneOf ?? []).filter(
    (variant) => variant.type !== "null",
  );
  if (nonNullVariants.length === 1 && nonNullVariants[0] !== undefined) {
    return resolveSchema(nonNullVariants[0], schemas);
  }

  return schema;
}

function isNullableSchema(schema: SpecSchema): boolean {
  return (
    [schema.type].flat().includes("null") ||
    (schema.anyOf ?? schema.oneOf ?? []).some(
      (variant) => variant.type === "null",
    )
  );
}

/** A full example: the documented example, else one built from the fields. */
export function buildExampleValue(
  schema: SpecSchema,
  schemas: Record<string, SpecSchema>,
  depth = 0,
): unknown {
  if (schema.examples !== undefined && schema.examples.length > 0) {
    return schema.examples[0];
  }
  const resolvedSchema = resolveSchema(schema, schemas);
  if (
    resolvedSchema.examples !== undefined &&
    resolvedSchema.examples.length > 0
  ) {
    return resolvedSchema.examples[0];
  }
  if (resolvedSchema.const !== undefined) {
    return resolvedSchema.const;
  }
  if (resolvedSchema.enum !== undefined) {
    return resolvedSchema.enum[0];
  }
  if (depth > 4) {
    return null;
  }
  const firstVariant = (resolvedSchema.anyOf ?? resolvedSchema.oneOf ?? [])[0];
  if (firstVariant !== undefined) {
    return buildExampleValue(firstVariant, schemas, depth + 1);
  }
  if (resolvedSchema.properties !== undefined) {
    return Object.fromEntries(
      Object.entries(resolvedSchema.properties).map(
        ([propertyName, propertySchema]) => [
          propertyName,
          buildExampleValue(propertySchema, schemas, depth + 1),
        ],
      ),
    );
  }
  if (resolvedSchema.items !== undefined) {
    return [buildExampleValue(resolvedSchema.items, schemas, depth + 1)];
  }
  const typeName = [resolvedSchema.type].flat()[0];

  return (
    { string: "", integer: 0, number: 0, boolean: false }[typeName ?? ""] ?? {}
  );
}

/** A file name for a raw body example, by its type. */
export function readRawBodyFileName(contentType: string): string {
  return contentType === "message/rfc822" ? "message.eml" : "body.json";
}

function readRawBodyExample(contentType: string): string {
  if (contentType === "message/rfc822") {
    return "From: app@app.test\r\nTo: user@example.test\r\nSubject: Hello\r\n\r\nHi!";
  }

  return '{"text": "hello"}';
}

/** Path and query parameters, then the body's top-level fields (or the raw body). */
export function listOperationInputs(
  operationEntry: SpecOperationEntry,
  schemas: Record<string, SpecSchema>,
): OperationInput[] {
  const parameterInputs = (operationEntry.operation.parameters ?? []).map(
    (parameter): OperationInput => ({
      name: parameter.name,
      location: parameter.in,
      schema: parameter.schema,
      isRequired: parameter.required ?? false,
      description: parameter.description ?? "",
      example: parameter.example,
    }),
  );
  const [contentType, mediaType] =
    Object.entries(operationEntry.operation.requestBody?.content ?? {})[0] ??
    [];
  if (contentType === undefined || mediaType === undefined) {
    return parameterInputs;
  }
  if (!contentType.includes("json")) {
    return [
      ...parameterInputs,
      {
        name: "body",
        location: "raw_body",
        schema: { type: "string" },
        isRequired: true,
        description: `The raw request body (${contentType}).`,
        example: readRawBodyExample(contentType),
        contentType,
      },
    ];
  }
  const bodySchema = resolveSchema(mediaType.schema, schemas);
  // A nullable field may be left out: the CLI and MCP send null for it.
  const requiredNames = new Set(bodySchema.required ?? []);
  const bodyInputs = Object.entries(bodySchema.properties ?? {}).map(
    ([propertyName, propertySchema]): OperationInput => ({
      name: propertyName,
      location: "body",
      schema: propertySchema,
      isRequired:
        requiredNames.has(propertyName) && !isNullableSchema(propertySchema),
      description:
        propertySchema.description ??
        resolveSchema(propertySchema, schemas).description ??
        "",
      example: buildExampleValue(propertySchema, schemas),
    }),
  );

  return [...parameterInputs, ...bodyInputs];
}
