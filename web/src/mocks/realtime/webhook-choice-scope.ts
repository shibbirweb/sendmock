import type { WebhookChoice, WebhookRequestEdit } from "@/lib/api/types";

/** What the action being handled chose for its webhooks. */
export type ActiveWebhookChoice = {
  /** Null while the rules decide; else exactly these endpoints. */
  endpointIds: string[] | null;
  /** Payloads edited for this action, by endpoint (WH-14.4). */
  editedRequests: WebhookRequestEdit[];
};

let activeWebhookChoice: ActiveWebhookChoice | null = null;

/** The choice of the action being handled, or null to let the rules send the rendered payloads. */
export function readActiveWebhookChoice(): ActiveWebhookChoice | null {
  return activeWebhookChoice;
}

function toActiveWebhookChoice(
  webhookChoice: WebhookChoice,
): ActiveWebhookChoice | null {
  const webhookEndpointIds = webhookChoice.webhook_endpoint_ids;
  const editedRequests = webhookChoice.webhook_requests ?? [];
  if (webhookEndpointIds === undefined && editedRequests.length === 0) {
    return null;
  }

  return {
    endpointIds:
      webhookEndpointIds === undefined
        ? null
        : [...new Set(webhookEndpointIds)],
    editedRequests,
  };
}

/**
 * Runs the part of a simulating handler that publishes events, so they go to
 * the chosen endpoints instead of the rule matches, with the edited payloads,
 * as the server carries the choice on each event (WH-13.4, WH-14.4).
 */
export function runWithWebhookChoice<ActionResult>(
  webhookChoice: WebhookChoice,
  runAction: () => ActionResult,
): ActionResult {
  const previousChoice = activeWebhookChoice;
  activeWebhookChoice = toActiveWebhookChoice(webhookChoice);
  try {
    return runAction();
  } finally {
    activeWebhookChoice = previousChoice;
  }
}
