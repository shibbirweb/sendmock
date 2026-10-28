import type {
  ApiEndpoint,
  QueryParameter,
  SchemaReference,
} from "../../src/lib/api/endpoint-registry";
import { pathParameterDocs } from "../../src/lib/api/endpoint-registry/path-parameters";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import { type JsonSchema, toComponentName } from "./generate-schemas";
import { readSchemaTypeName } from "./schema-roots";

const errorResponses: Record<number, { name: string; description: string }> = {
  400: { name: "BadRequest", description: "The request is invalid." },
  404: { name: "NotFound", description: "The item does not exist." },
  408: {
    name: "Timeout",
    description: "Nothing matched before the timeout.",
  },
  409: { name: "Conflict", description: "The item's state does not allow it." },
  422: {
    name: "Unprocessable",
    description: "The content does not parse or render.",
  },
  502: {
    name: "BadGateway",
    description: "An outside service, such as GitHub, could not be reached.",
  },
};

const apiDescription = [
  "The REST API of SendMock, the local email, SMS and webhook testing server.",
  "",
  "- JSON in and out; field names are snake_case.",
  '- Errors: `{ "error": { "code": "not_found", "message": "..." } }` with the matching HTTP status.',
  "- Lists that can grow are paged with an opaque `next_cursor`.",
  "- No auth by default; with `--ui-auth` the same basic auth or an API token protects the API.",
  "",
  "Generated from the endpoint registry and the TypeScript API types (`bun run openapi`); do not edit by hand.",
].join("\n");

function referenceSchema(typeName: string): JsonSchema {
  return { $ref: `#/components/schemas/${toComponentName(typeName)}` };
}

function buildSchema(schemaReference: SchemaReference): JsonSchema {
  if (schemaReference.kind === "file") {
    return { type: "string", format: "binary" };
  }
  if (schemaReference.kind === "list") {
    return { type: "array", items: referenceSchema(schemaReference.typeName) };
  }

  return referenceSchema(readSchemaTypeName(schemaReference) ?? "");
}

function buildContent(schemaReference: SchemaReference): JsonSchema {
  const contentType =
    schemaReference.kind === "file"
      ? schemaReference.contentType
      : "application/json";

  return { [contentType]: { schema: buildSchema(schemaReference) } };
}

/** Index-like path parameters are integers; ids, keys and names are strings. */
function buildPathParameter(parameterName: string): JsonSchema {
  const isInteger =
    /Index$/.test(parameterName) || parameterName === "revision";

  const pathParameterDoc = pathParameterDocs[parameterName];
  if (pathParameterDoc === undefined) {
    throw new Error(
      `Path parameter {${parameterName}} has no entry in path-parameters.ts`,
    );
  }

  return {
    name: parameterName,
    in: "path",
    required: true,
    description: pathParameterDoc.description,
    schema: { type: isInteger ? "integer" : "string" },
    example: pathParameterDoc.example,
  };
}

function buildQueryParameter(queryParameter: QueryParameter): JsonSchema {
  return {
    name: queryParameter.name,
    in: "query",
    required: queryParameter.isRequired ?? false,
    description: queryParameter.description,
    schema:
      typeof queryParameter.schema === "string"
        ? { type: queryParameter.schema }
        : buildSchema(queryParameter.schema),
    example: queryParameter.example,
  };
}

/** `GET /api/v1/emails/{emailId}/timeline` becomes `getEmailsByEmailIdTimeline`. */
export function buildOperationId(apiEndpoint: ApiEndpoint): string {
  const pathWords = apiEndpoint.path
    .replace(/^\/api\/v1/, "")
    .split(/[/-]/)
    .filter((pathSegment) => pathSegment !== "")
    .map((pathSegment) => {
      const parameterMatch = pathSegment.match(/^\{(\w+)\}$/);
      const word = parameterMatch?.[1] ?? pathSegment;
      const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
      return parameterMatch ? `By${capitalizedWord}` : capitalizedWord;
    });

  return `${apiEndpoint.method.toLowerCase()}${pathWords.join("")}`;
}

function buildResponses(apiEndpoint: ApiEndpoint): JsonSchema {
  const successStatus = apiEndpoint.successStatus ?? 200;
  const successResponse =
    apiEndpoint.response === null
      ? { description: "No content." }
      : {
          description: successStatus === 201 ? "Created." : "OK.",
          content: buildContent(apiEndpoint.response),
        };
  const errorEntries = (apiEndpoint.errorStatuses ?? []).map((errorStatus) => [
    String(errorStatus),
    {
      $ref: `#/components/responses/${errorResponses[errorStatus]?.name ?? "Error"}`,
    },
  ]);

  return {
    [String(successStatus)]: successResponse,
    ...Object.fromEntries(errorEntries),
    default: { $ref: "#/components/responses/Error" },
  };
}

/** The CLI command, MCP tool and UI place of an operation (UI-11.3). */
function buildSurfaceExtensions(apiEndpoint: ApiEndpoint): JsonSchema {
  const operationKey = `${apiEndpoint.method} ${apiEndpoint.path}`;
  const operationSurfaces = surfaceCatalogue[operationKey];
  if (operationSurfaces === undefined) {
    throw new Error(`${operationKey} has no entry in the surface catalogue`);
  }

  return {
    "x-sendmock-cli": operationSurfaces.cli,
    "x-sendmock-mcp": operationSurfaces.mcp,
    ...(operationSurfaces.mcpExemptReason === undefined
      ? {}
      : { "x-sendmock-mcp-exempt": operationSurfaces.mcpExemptReason }),
    "x-sendmock-ui": operationSurfaces.ui,
  };
}

function buildOperation(apiEndpoint: ApiEndpoint): JsonSchema {
  const pathParameterNames = [...apiEndpoint.path.matchAll(/\{(\w+)\}/g)].map(
    (parameterMatch) => parameterMatch[1] ?? "",
  );
  const parameters = [
    ...pathParameterNames.map(buildPathParameter),
    ...(apiEndpoint.queryParameters ?? []).map(buildQueryParameter),
  ];

  return {
    operationId: buildOperationId(apiEndpoint),
    summary: apiEndpoint.summary,
    tags: [apiEndpoint.tag],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(apiEndpoint.requestBody === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: buildContent(apiEndpoint.requestBody),
          },
        }),
    responses: buildResponses(apiEndpoint),
    ...buildSurfaceExtensions(apiEndpoint),
  };
}

function buildSharedResponses(): JsonSchema {
  const errorContent = {
    "application/json": { schema: referenceSchema("ApiErrorBody") },
  };
  const namedResponses = Object.values(errorResponses).map(
    ({ name, description }) => [name, { description, content: errorContent }],
  );

  return Object.fromEntries([
    ...namedResponses,
    ["Error", { description: "Any other error.", content: errorContent }],
  ]);
}

/** The OpenAPI 3.1 document for the endpoints, with the generated schemas. */
export function buildOpenApiDocument(
  apiEndpoints: ApiEndpoint[],
  componentSchemas: Record<string, JsonSchema>,
): JsonSchema {
  const paths: Record<string, Record<string, JsonSchema>> = {};
  for (const apiEndpoint of apiEndpoints) {
    paths[apiEndpoint.path] = {
      ...paths[apiEndpoint.path],
      [apiEndpoint.method.toLowerCase()]: buildOperation(apiEndpoint),
    };
  }
  const tagNames = [
    ...new Set(apiEndpoints.map((apiEndpoint) => apiEndpoint.tag)),
  ];

  return {
    openapi: "3.1.0",
    info: {
      title: "SendMock API",
      version: "1.0.0",
      description: apiDescription,
    },
    servers: [
      { url: "http://127.0.0.1:8025", description: "Default local address" },
    ],
    tags: tagNames.map((tagName) => ({ name: tagName })),
    paths,
    components: {
      schemas: componentSchemas,
      responses: buildSharedResponses(),
    },
  };
}
