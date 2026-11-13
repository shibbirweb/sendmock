import { mockDatabase } from "@/mocks/db/mock-database";
import { createErrorResponse } from "@/mocks/handlers/handler-utils";

/**
 * A `422` naming the first chosen endpoint that does not exist or is
 * disabled, as the server answers before acting (WH-13.5); null when every
 * chosen endpoint can receive.
 */
export function refuseUnavailableEndpoint(
  webhookEndpointIds: string[] | undefined,
): Response | null {
  for (const endpointId of webhookEndpointIds ?? []) {
    const endpointRecord = mockDatabase.webhookEndpoints.find(
      (existingEndpoint) => existingEndpoint.id === endpointId,
    );
    if (endpointRecord === undefined) {
      return createErrorResponse(
        422,
        "webhook_endpoint_unavailable",
        `No webhook endpoint has the ID ${endpointId}`,
      );
    }
    if (!endpointRecord.is_enabled) {
      return createErrorResponse(
        422,
        "webhook_endpoint_unavailable",
        `The webhook endpoint ${endpointRecord.name} (${endpointId}) is disabled`,
      );
    }
  }

  return null;
}
