import type {
  EndpointPreviewRequest,
  MatchedWebhookRequest,
  WebhookRuleMatchRequest,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { renderEndpointRequest } from "@/mocks/webhooks/render-endpoint-request";

/** The message the event is about, as the preview reads it; none renders the sample. */
function readSubjectIds(
  matchRequest: WebhookRuleMatchRequest,
): Pick<EndpointPreviewRequest, "email_id" | "sms_id"> {
  if (matchRequest.subject_id === undefined) {
    return {};
  }
  if (
    matchRequest.event_type.startsWith("email.") &&
    mockDatabase.emails.some((email) => email.id === matchRequest.subject_id)
  ) {
    return { email_id: matchRequest.subject_id };
  }
  if (
    matchRequest.event_type.startsWith("sms.") &&
    mockDatabase.smsMessages.some(
      (smsMessage) => smsMessage.id === matchRequest.subject_id,
    )
  ) {
    return { sms_id: matchRequest.subject_id };
  }

  return {};
}

/**
 * The request each matching endpoint, then each chosen one not already
 * shown, would send for the event, rendered as the endpoint preview renders
 * it (WH-14.1); nothing is stored or sent.
 */
export function renderMatchedRequests(
  matchRequest: WebhookRuleMatchRequest,
  matchedEndpointIds: string[],
): MatchedWebhookRequest[] {
  const shownEndpointIds = [
    ...new Set([
      ...matchedEndpointIds,
      ...(matchRequest.webhook_endpoint_ids ?? []),
    ]),
  ];
  const subjectIds = readSubjectIds(matchRequest);

  return shownEndpointIds.flatMap((endpointId) => {
    const endpointRecord = mockDatabase.webhookEndpoints.find(
      (existingEndpoint) => existingEndpoint.id === endpointId,
    );
    const previewResult = renderEndpointRequest(mockDatabase, {
      endpoint_id: endpointId,
      ...subjectIds,
    });
    if (endpointRecord === undefined || previewResult === null) {
      return [];
    }

    return [
      {
        endpoint_id: endpointId,
        endpoint_name: endpointRecord.name,
        event_type: matchRequest.event_type,
        method: previewResult.method,
        url: previewResult.url,
        headers: previewResult.headers,
        body: previewResult.body,
        problems: previewResult.problems,
      },
    ];
  });
}
