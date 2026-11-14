import type {
  ApiEndpoint,
  SchemaReference,
} from "../../src/lib/api/endpoint-registry";

/**
 * The TypeScript type a reference becomes in the generated schemas: the type
 * itself, `PageOf<T>` for pages, and a `TPatch` alias of `Partial<T>` written
 * into the entry file. Files have no schema type.
 */
export function readSchemaTypeName(
  schemaReference: SchemaReference,
): string | null {
  if (schemaReference.kind === "page") {
    return `PageOf<${schemaReference.typeName}>`;
  }
  if (schemaReference.kind === "partial") {
    return `${schemaReference.typeName}Patch`;
  }
  if (schemaReference.kind === "file") {
    return null;
  }

  return schemaReference.typeName;
}

function listSchemaReferences(apiEndpoint: ApiEndpoint): SchemaReference[] {
  const querySchemas = (apiEndpoint.queryParameters ?? []).flatMap(
    (queryParameter) =>
      typeof queryParameter.schema === "string" ? [] : [queryParameter.schema],
  );

  return [
    ...querySchemas,
    ...(apiEndpoint.requestBody === undefined ? [] : [apiEndpoint.requestBody]),
    ...(apiEndpoint.response === null ? [] : [apiEndpoint.response]),
  ];
}

/** Every API type the endpoints name, without duplicates, sorted. */
function listReferencedTypeNames(apiEndpoints: ApiEndpoint[]): string[] {
  const typeNames = apiEndpoints
    .flatMap(listSchemaReferences)
    .flatMap((schemaReference) =>
      schemaReference.kind === "file" ? [] : [schemaReference.typeName],
    );

  return [...new Set(typeNames)].sort();
}

/**
 * The entry file the schema generator reads: the referenced API types, the
 * partial aliases, and one root type that points at all of them.
 * Shared types (the error body) are used by every operation, not named by one.
 */
export function buildSchemaEntrySource(
  apiEndpoints: ApiEndpoint[],
  typesModulePath: string,
  sharedTypeNames: string[],
): { entrySource: string; rootTypeName: string } {
  const referencedTypeNames = [
    ...new Set([...listReferencedTypeNames(apiEndpoints), ...sharedTypeNames]),
  ].sort();
  const aliasLines = new Set<string>();
  const rootTypeExpressions = new Set<string>(sharedTypeNames);

  for (const schemaReference of apiEndpoints.flatMap(listSchemaReferences)) {
    const schemaTypeName = readSchemaTypeName(schemaReference);
    if (schemaTypeName === null || schemaReference.kind === "file") {
      continue;
    }
    rootTypeExpressions.add(schemaTypeName);
    if (schemaReference.kind === "partial") {
      aliasLines.add(
        `export type ${schemaTypeName} = Partial<${schemaReference.typeName}>;`,
      );
    }
  }

  const rootTypeName = "OpenApiSchemaRoots";
  const rootProperties = [...rootTypeExpressions]
    .sort()
    .map(
      (typeExpression, propertyIndex) =>
        `  root${propertyIndex}: ${typeExpression};`,
    );
  const entrySource = [
    `import type { PageOf, ${referencedTypeNames.join(", ")} } from "${typesModulePath}";`,
    `export type { ${referencedTypeNames.join(", ")} } from "${typesModulePath}";`,
    ...[...aliasLines].sort(),
    `export type ${rootTypeName} = {`,
    ...rootProperties,
    "};",
    "",
  ].join("\n");

  return { entrySource, rootTypeName };
}
