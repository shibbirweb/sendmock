/** The parts of an OpenAPI 3.1 document the reference and playground read. */

export type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
};

export type SchemaComponents = Record<string, JsonSchema>;

export type ApiParameter = {
  name: string;
  location: "path" | "query";
  isRequired: boolean;
  description: string;
  schema: JsonSchema;
};

export type ApiBody = { contentType: string; schema: JsonSchema };

export type ApiResponse = {
  status: string;
  description: string;
  body: ApiBody | null;
};

/** One operation, flattened for rendering and for the request builder. */
export type ApiOperation = {
  operationId: string;
  method: string;
  path: string;
  summary: string;
  tag: string;
  tagSlug: string;
  parameters: ApiParameter[];
  requestBody: ApiBody | null;
  responses: ApiResponse[];
  surfaces: OperationSurfaces;
};

/** The same operation from the CLI, an AI agent and the UI (`x-sendmock-*`, UI-11.3). */
export type OperationSurfaces = {
  cli: string;
  /** Null only where agents may not act, with the reason. */
  mcp: string | null;
  mcpExemptReason: string | null;
  ui: string;
};
