import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { indexReferencesByOperation } from "@/lib/reference/load-references";

import type {
  ApiBody,
  ApiOperation,
  ApiParameter,
  ApiResponse,
  JsonSchema,
  SchemaComponents,
} from "./openapi-types";

type RawContent = Record<string, { schema: JsonSchema }> | undefined;
type RawOperation = {
  operationId: string;
  summary: string;
  tags: string[];
  parameters?: {
    name: string;
    in: "path" | "query";
    required?: boolean;
    description?: string;
    schema: JsonSchema;
  }[];
  requestBody?: { content: RawContent };
  "x-sendmock-cli": string;
  "x-sendmock-mcp": string | null;
  "x-sendmock-mcp-exempt"?: string;
  "x-sendmock-ui": string;
  responses: Record<
    string,
    { $ref?: string; description?: string; content?: RawContent }
  >;
};
type RawDocument = {
  info: { description: string };
  tags: { name: string }[];
  paths: Record<string, Record<string, RawOperation>>;
  components: {
    schemas: SchemaComponents;
    responses: Record<string, { description: string; content?: RawContent }>;
  };
};

export function toTagSlug(tagName: string): string {
  return tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function readBody(content: RawContent): ApiBody | null {
  const [contentType, mediaType] = Object.entries(content ?? {})[0] ?? [];
  return contentType && mediaType
    ? { contentType, schema: mediaType.schema }
    : null;
}

/** The frozen contract, docs/api/openapi.yaml, read when the site is built. */
function readOpenApiDocument(): RawDocument {
  return parse(
    readFileSync(join(process.cwd(), "../docs/api/openapi.yaml"), "utf8"),
  ) as RawDocument;
}

export function loadApiReference() {
  const rawDocument = readOpenApiDocument();
  const referenceUrls = indexReferencesByOperation();
  const sharedResponses = rawDocument.components.responses;
  const operations: ApiOperation[] = Object.entries(rawDocument.paths).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem).map(([method, rawOperation]) => {
        const parameters: ApiParameter[] = (rawOperation.parameters ?? []).map(
          (rawParameter) => ({
            name: rawParameter.name,
            location: rawParameter.in,
            isRequired: rawParameter.required ?? false,
            description: rawParameter.description ?? "",
            schema: rawParameter.schema,
          }),
        );
        const responses: ApiResponse[] = Object.entries(
          rawOperation.responses,
        ).map(([status, rawResponse]) => {
          const sharedResponse = rawResponse.$ref
            ? sharedResponses[rawResponse.$ref.split("/").pop() ?? ""]
            : undefined;
          const resolvedResponse = sharedResponse ?? rawResponse;
          return {
            status,
            description: resolvedResponse.description ?? "",
            body: readBody(resolvedResponse.content),
          };
        });
        const tag = rawOperation.tags[0] ?? "Other";
        return {
          operationId: rawOperation.operationId,
          method: method.toUpperCase(),
          path,
          summary: rawOperation.summary,
          tag,
          tagSlug: toTagSlug(tag),
          parameters,
          requestBody: readBody(rawOperation.requestBody?.content),
          responses,
          surfaces: {
            cli: rawOperation["x-sendmock-cli"],
            cliUrl:
              referenceUrls.get(`${method.toUpperCase()} ${path}`)?.cliUrl ??
              null,
            mcpUrl:
              referenceUrls.get(`${method.toUpperCase()} ${path}`)?.mcpUrl ??
              null,
            mcp: rawOperation["x-sendmock-mcp"],
            mcpExemptReason: rawOperation["x-sendmock-mcp-exempt"] ?? null,
            ui: rawOperation["x-sendmock-ui"],
          },
        };
      }),
  );

  return {
    description: rawDocument.info.description,
    tagNames: rawDocument.tags.map((tag) => tag.name),
    operations,
    schemas: rawDocument.components.schemas,
  };
}
