import { useQuery } from "@tanstack/react-query";

import { requestOpenApiDocument } from "@/lib/api/api-client";
import {
  type OpenApiDocument,
  readReferenceOperations,
} from "@/lib/api/openapi-reference";

/** The operations of the instance's own OpenAPI document; it changes only with a new version. */
export function useReferenceOperations() {
  return useQuery({
    queryKey: ["openapi-document"],
    queryFn: async ({ signal }) =>
      readReferenceOperations(
        await requestOpenApiDocument<OpenApiDocument>(signal),
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
