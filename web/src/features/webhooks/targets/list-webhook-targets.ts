import type { WebhookEndpoint, WebhookRuleMatchResult } from "@/lib/api/types";

/** One endpoint a simulation will send its event to. */
export type WebhookTarget = {
  endpointId: string;
  endpointName: string;
  endpointUrl: string;
};

/**
 * The endpoints an event will reach: the chosen ones when the action chose,
 * else each rule match's endpoint once, in rule order (WH-13.2).
 */
export function listWebhookTargets({
  matchResult,
  chosenEndpointIds,
  webhookEndpoints,
}: {
  matchResult: WebhookRuleMatchResult | undefined;
  chosenEndpointIds: string[] | null;
  webhookEndpoints: WebhookEndpoint[];
}): WebhookTarget[] {
  if (chosenEndpointIds !== null) {
    return chosenEndpointIds.flatMap((endpointId) => {
      const webhookEndpoint = webhookEndpoints.find(
        (existingEndpoint) => existingEndpoint.id === endpointId,
      );

      return webhookEndpoint === undefined
        ? []
        : [
            {
              endpointId,
              endpointName: webhookEndpoint.name,
              endpointUrl: webhookEndpoint.url,
            },
          ];
    });
  }
  const matchedTargets = new Map<string, WebhookTarget>();
  for (const matchedRule of matchResult?.webhook_rules ?? []) {
    if (!matchedTargets.has(matchedRule.endpoint_id)) {
      matchedTargets.set(matchedRule.endpoint_id, {
        endpointId: matchedRule.endpoint_id,
        endpointName: matchedRule.endpoint_name,
        endpointUrl: matchedRule.endpoint_url,
      });
    }
  }

  return [...matchedTargets.values()];
}
