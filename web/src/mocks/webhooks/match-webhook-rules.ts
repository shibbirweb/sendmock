import type {
  WebhookRuleMatchRequest,
  WebhookRuleMatchResult,
} from "@/lib/api/types";
import type { RuleMessage } from "@/lib/webhooks/rule-filter/read-message-field";
import {
  findFiringRules,
  findSubjectMessage,
  isRuledEvent,
} from "@/mocks/webhooks/fire-matching-rules";
import { renderMatchedRequests } from "@/mocks/webhooks/render-matched-requests";

/**
 * Which webhooks an event would trigger, with the rule matching firing runs,
 * and with `include_requests` the request each would send; nothing is stored
 * or sent (WH-13.1, WH-14.1).
 */
export function matchWebhookRules(
  matchRequest: WebhookRuleMatchRequest,
): WebhookRuleMatchResult {
  const isRequestsIncluded = matchRequest.include_requests === true;
  if (!isRuledEvent(matchRequest.event_type)) {
    return isRequestsIncluded
      ? { webhook_rules: [], webhook_requests: [] }
      : { webhook_rules: [] };
  }
  const storedMessage = findSubjectMessage(
    matchRequest.event_type,
    matchRequest.subject_id,
  );
  const ruleMessage: RuleMessage | null =
    matchRequest.data === undefined
      ? storedMessage
      : {
          messageKind: "fields",
          fieldValues: matchRequest.data,
          storedMessage,
        };

  const webhookRules = findFiringRules(
    matchRequest.event_type,
    ruleMessage,
  ).map(({ webhookRule, endpointRecord }) => ({
    rule_id: webhookRule.id,
    rule_name: webhookRule.name,
    endpoint_id: endpointRecord.id,
    endpoint_name: endpointRecord.name,
    endpoint_url: endpointRecord.url,
  }));
  if (!isRequestsIncluded) {
    return { webhook_rules: webhookRules };
  }

  return {
    webhook_rules: webhookRules,
    webhook_requests: renderMatchedRequests(
      matchRequest,
      webhookRules.map((matchedRule) => matchedRule.endpoint_id),
    ),
  };
}
