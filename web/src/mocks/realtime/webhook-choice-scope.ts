let activeWebhookChoice: string[] | null = null;

/** The endpoints the action being handled chose, or null to let the rules decide. */
export function readActiveWebhookChoice(): string[] | null {
  return activeWebhookChoice;
}

/**
 * Runs the part of a simulating handler that publishes events, so they go to
 * the chosen endpoints instead of the rule matches, as the server carries the
 * choice on each event (WH-13.4).
 */
export function runWithWebhookChoice<ActionResult>(
  webhookEndpointIds: string[] | undefined,
  runAction: () => ActionResult,
): ActionResult {
  const previousChoice = activeWebhookChoice;
  activeWebhookChoice =
    webhookEndpointIds === undefined ? null : [...new Set(webhookEndpointIds)];
  try {
    return runAction();
  } finally {
    activeWebhookChoice = previousChoice;
  }
}
