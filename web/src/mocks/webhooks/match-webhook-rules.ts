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

/**
 * Which webhooks an event would trigger, with the rule matching firing runs;
 * nothing is stored or sent (WH-13.1).
 */
export function matchWebhookRules(
  matchRequest: WebhookRuleMatchRequest,
): WebhookRuleMatchResult {
  if (!isRuledEvent(matchRequest.event_type)) {
    return { webhook_rules: [] };
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

  return {
    webhook_rules: findFiringRules(matchRequest.event_type, ruleMessage).map(
      ({ webhookRule, endpointRecord }) => ({
        rule_id: webhookRule.id,
        rule_name: webhookRule.name,
        endpoint_id: endpointRecord.id,
        endpoint_name: endpointRecord.name,
        endpoint_url: endpointRecord.url,
      }),
    ),
  };
}
