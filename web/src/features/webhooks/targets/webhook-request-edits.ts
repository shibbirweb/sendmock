import type { WebhookChoice, WebhookRequestEdit } from "@/lib/api/types";

/** The edits with the one for this endpoint replaced, or removed when null. */
export function replaceRequestEdit(
  requestEdits: WebhookRequestEdit[],
  endpointId: string,
  requestEdit: WebhookRequestEdit | null,
): WebhookRequestEdit[] {
  const otherEdits = requestEdits.filter(
    (existingEdit) => existingEdit.endpoint_id !== endpointId,
  );

  return requestEdit === null ? otherEdits : [...otherEdits, requestEdit];
}

/** The edit made for one endpoint, if any. */
export function findRequestEdit(
  requestEdits: WebhookRequestEdit[],
  endpointId: string,
): WebhookRequestEdit | null {
  return (
    requestEdits.find(
      (existingEdit) => existingEdit.endpoint_id === endpointId,
    ) ?? null
  );
}

/**
 * The request body an action sends: the chosen endpoints, or none to let the
 * rules decide, and the edits of the endpoints it still sends to (WH-13.4,
 * WH-14.4). An edit of an endpoint the action no longer sends to is dropped,
 * since the server refuses an edit outside the chosen endpoints.
 */
export function toWebhookChoice({
  chosenEndpointIds,
  targetEndpointIds,
  requestEdits,
}: {
  chosenEndpointIds: string[] | null;
  targetEndpointIds: string[];
  requestEdits: WebhookRequestEdit[];
}): WebhookChoice {
  const sentEdits = requestEdits.filter((requestEdit) =>
    targetEndpointIds.includes(requestEdit.endpoint_id),
  );

  return {
    ...(chosenEndpointIds === null
      ? {}
      : { webhook_endpoint_ids: chosenEndpointIds }),
    ...(sentEdits.length === 0 ? {} : { webhook_requests: sentEdits }),
  };
}
