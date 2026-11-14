import type { WebhookChoice } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createErrorResponse } from "@/mocks/handlers/handler-utils";

function refuseEndpoint(message: string): Response {
  return createErrorResponse(422, "webhook_endpoint_unavailable", message);
}

function refuseMissingOrDisabled(endpointId: string): Response | null {
  const endpointRecord = mockDatabase.webhookEndpoints.find(
    (existingEndpoint) => existingEndpoint.id === endpointId,
  );
  if (endpointRecord === undefined) {
    return refuseEndpoint(`No webhook endpoint has the ID ${endpointId}`);
  }
  if (!endpointRecord.is_enabled) {
    return refuseEndpoint(
      `The webhook endpoint ${endpointRecord.name} (${endpointId}) is disabled`,
    );
  }

  return null;
}

/**
 * A `422` naming the first chosen or edited endpoint that does not exist or
 * is disabled, or an edited one left out of the chosen endpoints, as the
 * server answers before acting (WH-13.5, WH-14.4); null when the choice can
 * be sent.
 */
export function refuseUnavailableEndpoint(
  webhookChoice: WebhookChoice,
): Response | null {
  const chosenEndpointIds = webhookChoice.webhook_endpoint_ids;
  for (const endpointId of chosenEndpointIds ?? []) {
    const refusal = refuseMissingOrDisabled(endpointId);
    if (refusal !== null) {
      return refusal;
    }
  }
  for (const requestEdit of webhookChoice.webhook_requests ?? []) {
    const refusal = refuseMissingOrDisabled(requestEdit.endpoint_id);
    if (refusal !== null) {
      return refusal;
    }
    if (
      chosenEndpointIds !== undefined &&
      !chosenEndpointIds.includes(requestEdit.endpoint_id)
    ) {
      return refuseEndpoint(
        `The webhook endpoint ${requestEdit.endpoint_id} has an edited request but is not in webhook_endpoint_ids`,
      );
    }
  }

  return null;
}
