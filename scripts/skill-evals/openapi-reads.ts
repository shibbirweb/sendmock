type SchemaObject = {
  $ref?: string;
  type?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  allOf?: SchemaObject[];
};

type OpenApiDocument = {
  paths: Record<
    string,
    {
      get?: {
        responses?: Record<
          string,
          { content?: { "application/json"?: { schema?: SchemaObject } } }
        >;
      };
    }
  >;
  components: { schemas: Record<string, SchemaObject> };
};

/** A `GET` operation and the fields of the items its answer lists (or of the answer itself). */
export type ReadOperation = { pathPattern: RegExp; itemFields: Set<string> };

function resolveSchema(
  schema: SchemaObject | undefined,
  document: OpenApiDocument,
): SchemaObject {
  if (schema?.$ref === undefined) {
    return schema ?? {};
  }
  const schemaName = schema.$ref.split("/").pop() ?? "";
  return resolveSchema(document.components.schemas[schemaName], document);
}

function collectFields(
  schema: SchemaObject,
  document: OpenApiDocument,
): Set<string> {
  const resolved = resolveSchema(schema, document);
  const fieldNames = new Set(Object.keys(resolved.properties ?? {}));
  for (const part of resolved.allOf ?? []) {
    for (const fieldName of collectFields(part, document)) {
      fieldNames.add(fieldName);
    }
  }
  return fieldNames;
}

/** The answer's items: an array's items, a page's `items`, or the answer itself. */
function findItemSchema(
  schema: SchemaObject,
  document: OpenApiDocument,
): SchemaObject {
  const resolved = resolveSchema(schema, document);
  if (resolved.type === "array") {
    return resolveSchema(resolved.items, document);
  }
  const listedItems = resolveSchema(resolved.properties?.items, document);
  if (listedItems.type === "array") {
    return resolveSchema(listedItems.items, document);
  }
  return resolved;
}

function buildPathPattern(templatePath: string): RegExp {
  const escapedPath = templatePath
    .split(/\{[^}]+\}/)
    .map((segment) => segment.replace(/[.*+?^$()|[\]\\]/g, "\\$&"))
    .join("[^/]+");
  return new RegExp(`^${escapedPath}$`);
}

export function listReadOperations(openApiYaml: string): ReadOperation[] {
  const document = Bun.YAML.parse(openApiYaml) as OpenApiDocument;
  return Object.entries(document.paths).flatMap(([templatePath, pathItem]) => {
    const answerSchema =
      pathItem.get?.responses?.["200"]?.content?.["application/json"]?.schema;
    if (answerSchema === undefined) {
      return [];
    }
    return [
      {
        pathPattern: buildPathPattern(templatePath),
        itemFields: collectFields(
          findItemSchema(answerSchema, document),
          document,
        ),
      },
    ];
  });
}

export function findReadOperation(
  readOperations: ReadOperation[],
  requestPath: string,
): ReadOperation | undefined {
  const pathWithoutQuery = requestPath.split("?")[0] ?? "";
  return readOperations.find((readOperation) =>
    readOperation.pathPattern.test(pathWithoutQuery),
  );
}
