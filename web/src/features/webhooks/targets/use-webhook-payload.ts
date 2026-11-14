import type { WebhookTargetEvent } from "@/features/webhooks/targets/use-webhook-targets";
import { useWebhookRuleMatch } from "@/lib/api/hooks/use-webhook-rule-queries";
import type { WebhookRuleMatchRequest } from "@/lib/api/types";

/**
 * The request one endpoint would send for the event about to fire, rendered
 * by the match with `include_requests` (WH-14.1); fetched only while shown.
 */
export function useWebhookPayload(
  targetEvent: WebhookTargetEvent,
  endpointId: string | null,
) {
  const matchRequest: WebhookRuleMatchRequest = {
    event_type: targetEvent.eventType,
    subject_id: targetEvent.subjectId,
    data: targetEvent.data,
    include_requests: true,
    webhook_endpoint_ids: endpointId === null ? [] : [endpointId],
  };
  const payloadQuery = useWebhookRuleMatch(matchRequest, endpointId !== null);
  const renderedRequest =
    (payloadQuery.data?.webhook_requests ?? []).find(
      (matchedRequest) => matchedRequest.endpoint_id === endpointId,
    ) ?? null;

  return {
    isLoading:
      endpointId !== null && renderedRequest === null && !payloadQuery.isError,
    isError: payloadQuery.isError,
    renderedRequest,
  };
}
