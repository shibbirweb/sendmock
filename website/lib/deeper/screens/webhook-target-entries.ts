import type { DeeperEntry } from "../deeper-types";

const webhooksGuideLink = "[Webhook rules](../../webhooks/rules.md).";

const pickerSteps =
  "Choose webhooks lists every enabled endpoint with a search box, the endpoints your rules would pick already checked, and says how many are chosen (or that no webhook will be sent).";

/** Choose beside a simulate menu item or a sample button: runs the action once with the endpoints picked. */
export function describeChooseWebhooks(
  controlName: string,
  actionOperationId: string,
): DeeperEntry {
  return {
    control: controlName,
    does: `Opens Choose webhooks for this one action. ${pickerSteps} Its confirm button, named after the action, runs it once and sends the event to exactly the checked endpoints; Cancel runs nothing.`,
    changes:
      "The chosen deliveries show `chosen` as their Trigger in Webhooks > Deliveries. Your rules stay as they are; the dialog's rules link opens them in a new tab.",
    operationIds: [actionOperationId, "postWebhooksRulesMatch"],
    links: webhooksGuideLink,
  };
}

/** Change in a composer's Webhooks row: picks the endpoints for the next send only. */
export function describeChangeWebhooks(
  actionName: string,
  whenRowUpdates: string,
): DeeperEntry {
  return {
    control: "button: Change",
    does: `In the Webhooks row: the endpoints ${actionName} will reach through your rules (or No webhook), each name opening the endpoint in a new tab, and Change. ${pickerSteps} Use these keeps the checked endpoints for this send, marked "chosen for this action", and Use the rules goes back to what the rules pick. ${whenRowUpdates}`,
    changes:
      "The chosen deliveries show `chosen` as their Trigger in Webhooks > Deliveries. Your rules stay as they are.",
    operationIds: ["postWebhooksRulesMatch", "getWebhooksEndpoints"],
    links: webhooksGuideLink,
  };
}

/** The line under a simulate menu item's label: the endpoints its event will reach. */
export const webhookTargetsUnderLabel =
  "Under the label, and read out by screen readers as its description: the endpoints the event will reach through your webhook rules, or No webhook.";
