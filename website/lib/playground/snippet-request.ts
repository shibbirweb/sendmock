import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import { buildExampleValue } from "@/lib/openapi/schema-tools";

import type { SnippetRequest } from "./build-snippets";

/** Where snippets point: a SendMock running on its default address. */
export const localInstanceUrl = "http://127.0.0.1:8025";

/** The playground's form values for one operation. */
export type PlaygroundFormValues = {
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  bodyText: string;
};

/** The body the form starts with: the full example for JSON, a line of text otherwise. */
export function buildInitialBody(
  operation: ApiOperation,
  schemas: SchemaComponents,
): string {
  if (operation.requestBody === null) {
    return "";
  }
  if (!operation.requestBody.contentType.includes("json")) {
    return "hello from the playground";
  }
  return JSON.stringify(
    buildExampleValue(operation.requestBody.schema, schemas),
    null,
    2,
  );
}

/** The path with its values filled in and the query values that are set. */
export function buildRequestPath(
  operationPath: string,
  pathValues: Record<string, string>,
  queryValues: Record<string, string>,
): string {
  const filledPath = operationPath.replace(
    /\{(\w+)\}/g,
    (_match, parameterName: string) =>
      encodeURIComponent(pathValues[parameterName] ?? ""),
  );
  const queryString = new URLSearchParams(
    Object.entries(queryValues).filter(([, queryValue]) => queryValue !== ""),
  ).toString();
  return queryString === "" ? filledPath : `${filledPath}?${queryString}`;
}

export function buildRequestHeaders(
  operation: ApiOperation,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (operation.requestBody) {
    // `*/*` (the capture URL takes anything) is not a sendable type.
    headers["content-type"] = operation.requestBody.contentType.includes("*")
      ? "text/plain"
      : operation.requestBody.contentType;
  }
  return headers;
}

/** The request the snippets show for the form's values, aimed at a local SendMock. */
export function buildSnippetRequest(
  operation: ApiOperation,
  formValues: PlaygroundFormValues,
): SnippetRequest {
  const requestPath = buildRequestPath(
    operation.path,
    formValues.pathValues,
    formValues.queryValues,
  );
  return {
    method: operation.method,
    url: `${localInstanceUrl}${requestPath}`,
    headers: buildRequestHeaders(operation),
    body: operation.requestBody === null ? null : formValues.bodyText,
  };
}
