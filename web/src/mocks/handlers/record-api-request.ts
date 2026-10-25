import type { ApiRequestLinkedMessage } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

/**
 * Adds a native API call to the request log, as the server does for every
 * request (SM-13.1), so demo sends and rejections show up in Logs > HTTP.
 */
export function recordNativeApiRequest({
  path,
  requestBody,
  responseStatus,
  responseBody,
  linkedMessage = null,
}: {
  path: string;
  requestBody: unknown;
  responseStatus: number;
  responseBody: unknown;
  linkedMessage?: ApiRequestLinkedMessage | null;
}): string {
  const apiRequestId = createMockUlid();
  mockDatabase.apiRequestLog.unshift({
    id: apiRequestId,
    api: "native",
    method: "POST",
    path,
    request_headers: { "content-type": "application/json" },
    request_body: JSON.stringify(requestBody),
    response_status: responseStatus,
    response_body: JSON.stringify(responseBody),
    duration_ms: 1,
    linked_message: linkedMessage,
    created_at: new Date().toISOString(),
  });

  return apiRequestId;
}
