/**
 * The shape of one REST endpoint in the registry that docs/api/openapi.yaml is
 * built from (UI-09). Types are named, not imported, so the build script can
 * read this file without the app's path aliases; the schemas come from the
 * TypeScript types of the same name in `src/lib/api/types`.
 */

export type HttpMethodName = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A body or response, by the name of its TypeScript type. */
export type SchemaReference =
  | { kind: "type"; typeName: string }
  | { kind: "list"; typeName: string }
  | { kind: "page"; typeName: string }
  | { kind: "partial"; typeName: string }
  | { kind: "file"; contentType: string };

export type QueryParameter = {
  name: string;
  description: string;
  schema: "string" | "integer" | "boolean" | SchemaReference;
  isRequired?: boolean;
};

export type ApiEndpoint = {
  method: HttpMethodName;
  /** Full path with `{name}` parameters, e.g. `/api/v1/emails/{emailId}`. */
  path: string;
  summary: string;
  tag: string;
  queryParameters?: QueryParameter[];
  requestBody?: SchemaReference;
  /** Null when the endpoint answers 204 No Content. */
  response: SchemaReference | null;
  successStatus?: 200 | 201 | 204;
  errorStatuses?: number[];
};

/** An endpoint as written in an area file; the area adds the tag. */
export type AreaEndpoint = Omit<ApiEndpoint, "tag">;

export function typeRef(typeName: string): SchemaReference {
  return { kind: "type", typeName };
}

export function listOf(typeName: string): SchemaReference {
  return { kind: "list", typeName };
}

/** `PageOf<T>`: items, next_cursor and total_count. */
export function pageOf(typeName: string): SchemaReference {
  return { kind: "page", typeName };
}

/** `Partial<T>`, for PATCH bodies that take only the changed keys. */
export function partialOf(typeName: string): SchemaReference {
  return { kind: "partial", typeName };
}

export function fileOf(contentType: string): SchemaReference {
  return { kind: "file", contentType };
}

export function tagEndpoints(
  tag: string,
  areaEndpoints: AreaEndpoint[],
): ApiEndpoint[] {
  return areaEndpoints.map((areaEndpoint) => ({ ...areaEndpoint, tag }));
}

/** `cursor` and `limit`, shared by every paged list. */
export const pageQueryParameters: QueryParameter[] = [
  {
    name: "cursor",
    description: "The next_cursor of the previous page.",
    schema: "string",
  },
  {
    name: "limit",
    description: "Items per page, 1 to 200 (default 50).",
    schema: "integer",
  },
];
