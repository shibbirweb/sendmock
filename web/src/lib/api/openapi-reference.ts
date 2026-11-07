/** What the API reference screen reads from an OpenAPI 3.1 document (PL-01.4). */

type SchemaObject = {
  $ref?: string;
  type?: string | string[];
  items?: SchemaObject;
};

type ParameterObject = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  example?: unknown;
};

type OperationObject = {
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: { content?: Record<string, { schema?: SchemaObject }> };
  responses?: Record<
    string,
    { content?: Record<string, { schema?: SchemaObject }> }
  >;
};

export type OpenApiDocument = {
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OperationObject>>;
};

export type ReferenceParameter = {
  name: string;
  location: string;
  isRequired: boolean;
  description: string;
  example: string | null;
};

export type ReferenceOperation = {
  operationId: string;
  method: string;
  path: string;
  summary: string;
  tag: string;
  parameters: ReferenceParameter[];
  /** The body's type name, such as `PaymentSimulateRequest`; none without a body. */
  requestBodyType: string | null;
  successStatus: string;
  /** The answer's type name; `PaymentDetail[]` for a list, none for no content. */
  responseType: string | null;
};

const httpMethods = ["get", "post", "put", "patch", "delete"];
const upperCaseSegments = new Set(["ai", "http", "sms", "smtp"]);

/** A heading for an operation without tags, from its path: `/api/v1/payments/...` is Payments. */
export function readTagFromPath(path: string): string {
  const firstSegment =
    path
      .replace(/^\/api\/v1\//, "")
      .replace(/^\//, "")
      .split("/")[0] ?? "";
  if (upperCaseSegments.has(firstSegment)) {
    return firstSegment.toUpperCase();
  }
  const words = firstSegment.replaceAll("-", " ");

  return words.charAt(0).toUpperCase() + words.slice(1) || "Other";
}

/** `#/components/schemas/PaymentDetail` reads as `PaymentDetail`, a list as `PaymentDetail[]`. */
export function describeSchema(
  schema: SchemaObject | undefined,
): string | null {
  if (schema === undefined) {
    return null;
  }
  if (schema.$ref !== undefined) {
    return schema.$ref.split("/").pop() ?? schema.$ref;
  }
  if (schema.type === "array") {
    return `${describeSchema(schema.items) ?? "unknown"}[]`;
  }
  return Array.isArray(schema.type)
    ? schema.type.join(" or ")
    : (schema.type ?? "object");
}

function readContentSchema(
  content: Record<string, { schema?: SchemaObject }> | undefined,
): SchemaObject | undefined {
  return Object.values(content ?? {})[0]?.schema;
}

function readOperation(
  path: string,
  method: string,
  operation: OperationObject,
): ReferenceOperation {
  const successStatus =
    Object.keys(operation.responses ?? {}).find((statusCode) =>
      statusCode.startsWith("2"),
    ) ?? "200";

  return {
    operationId: operation.operationId ?? `${method} ${path}`,
    method: method.toUpperCase(),
    path,
    summary: operation.summary ?? "",
    tag: operation.tags?.[0] ?? readTagFromPath(path),
    parameters: (operation.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      location: parameter.in,
      isRequired: parameter.required ?? false,
      description: parameter.description ?? "",
      example:
        parameter.example === undefined ? null : String(parameter.example),
    })),
    requestBodyType: describeSchema(
      readContentSchema(operation.requestBody?.content),
    ),
    successStatus,
    responseType: describeSchema(
      readContentSchema(operation.responses?.[successStatus]?.content),
    ),
  };
}

/** Every operation in the document, in its order. */
export function readReferenceOperations(
  openApiDocument: OpenApiDocument,
): ReferenceOperation[] {
  return Object.entries(openApiDocument.paths ?? {}).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => httpMethods.includes(method))
        .map(([method, operation]) => readOperation(path, method, operation)),
  );
}

/** A `curl` command for the operation on this instance, with the examples filled in. */
export function buildCurlCommand(
  referenceOperation: ReferenceOperation,
  instanceOrigin: string,
): string {
  const filledPath = referenceOperation.parameters
    .filter((parameter) => parameter.location === "path")
    .reduce(
      (pathText, parameter) =>
        pathText.replace(
          `{${parameter.name}}`,
          parameter.example ?? `<${parameter.name}>`,
        ),
      referenceOperation.path,
    );
  const commandParts = [`curl -X ${referenceOperation.method}`];
  if (referenceOperation.requestBodyType !== null) {
    commandParts.push("-H 'Content-Type: application/json'", "-d '{}'");
  }
  commandParts.push(`'${instanceOrigin}${filledPath}'`);

  return commandParts.join(" ");
}

/** Operations whose path, summary or operation id contain every word of the search. */
export function filterReferenceOperations(
  referenceOperations: ReferenceOperation[],
  searchText: string,
): ReferenceOperation[] {
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(Boolean);

  return referenceOperations.filter((referenceOperation) => {
    const searchableText =
      `${referenceOperation.method} ${referenceOperation.path} ${referenceOperation.summary} ${referenceOperation.operationId}`.toLowerCase();
    return searchWords.every((searchWord) =>
      searchableText.includes(searchWord),
    );
  });
}
