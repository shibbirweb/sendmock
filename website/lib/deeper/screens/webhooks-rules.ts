import type { DeeperEntry, DeeperPage } from "../deeper-types";

/** What fires each event a rule can send. */
const eventDescriptions: [string, string][] = [
  [
    "email.received",
    "an email your app sent arrives (SMTP, a provider API, sendmail or the native API)",
  ],
  [
    "email.inbound",
    "an incoming email arrives: a simulated reply or forward, or mail to an inbound domain",
  ],
  ["email.opened", "an email is opened"],
  ["email.clicked", "a link of an email is clicked"],
  ["email.delivered", "an email is marked delivered"],
  ["email.deferred", "an email's delivery is deferred"],
  ["email.bounced", "an email bounces"],
  ["email.complained", "a spam complaint is recorded"],
  ["email.unsubscribed", "an unsubscribe is recorded"],
  ["email.released", "an email is released to a real inbox"],
  ["email.deleted", "an email is deleted"],
  ["sms.sent", "your app sends an SMS"],
  ["sms.status", "an SMS changes status"],
  ["sms.opened", "an SMS is read"],
  ["sms.inbound", "an inbound SMS arrives"],
  ["verify.started", "a verification starts"],
  [
    "verify.checked",
    "a code is checked, or a verification is approved, canceled or runs out of attempts",
  ],
  ["verify.expired", "a verification expires"],
  ["http.captured", "the HTTP catcher captures a request"],
  ["payment.created", "a payment is created"],
  ["payment.authorized", "a payment is authorized"],
  ["payment.succeeded", "a payment succeeds"],
  ["payment.failed", "a payment fails"],
  ["payment.canceled", "a payment is canceled or voided"],
  ["payment.refunded", "a payment is refunded in full"],
  ["payment.partially_refunded", "part of a payment is refunded"],
  ["payment.dispute_opened", "a dispute is opened"],
  ["payment.dispute_updated", "a dispute is answered or changes"],
  ["payment.dispute_closed", "a dispute is closed"],
  ["checkout.completed", "a checkout is completed"],
  ["checkout.expired", "a checkout expires"],
  ["subscription.created", "a subscription is created"],
  ["subscription.renewed", "a subscription renews"],
  ["subscription.payment_failed", "a subscription's renewal payment fails"],
  ["subscription.canceled", "a subscription is canceled"],
  ["webhook.failed", "a webhook delivery fails for good"],
  ["test.ping", "an endpoint test is sent"],
];

const ruleListEntries: DeeperEntry[] = [
  { control: "heading: Rules", does: "Names the open screen in the header." },
  {
    control: "link: Read the Rules guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Rules](../../webhooks/rules.md).",
  },
  {
    control: "heading: Webhook rules",
    does: "The rules that decide which events go to which endpoint.",
    operationIds: ["getWebhooksRules"],
  },
  {
    control:
      "paragraph: Which events go to which endpoint, checked from top to bottom.",
    does: "Explains the screen: every matching rule delivers, in this order.",
  },
  {
    control: "button: Add rule",
    does: "Opens the new rule editor; in it, adds the rule.",
    operationIds: ["postWebhooksRules"],
  },
  {
    control: "combobox: Endpoint filter",
    does: "Shows the rules of every endpoint, or of one.",
  },
  {
    control: "columnheader: Order",
    does: "The rule's place, with buttons to move it.",
  },
  { control: "columnheader: Rule", does: "The rule's name and endpoint." },
  { control: "columnheader: Events", does: "The events it sends." },
  { control: "columnheader: Filter", does: "Its filter, in words." },
  { control: "columnheader: On", does: "Whether it is on." },
  { control: "columnheader: Actions", does: "Edit and Delete." },
  {
    control: "each item, button: Move … up",
    does: "Moves the rule one place up.",
    operationIds: ["postWebhooksRulesByRuleIdMove"],
  },
  {
    control: "each item, button: Move … down",
    does: "Moves the rule one place down.",
    operationIds: ["postWebhooksRulesByRuleIdMove"],
  },
  {
    control: "each item, switch: … enabled",
    does: "Turns the rule on or off at once.",
    operationIds: ["patchWebhooksRulesByRuleId"],
  },
  {
    control: "each item, button: Edit …",
    does: "Opens the rule's editor.",
    operationIds: ["getWebhooksRulesByRuleId"],
  },
  {
    control: "each item, button: Delete …",
    does: "Asks for confirmation, then deletes the rule.",
  },
  {
    control: "heading: Delete Support inbox to Laravel?",
    does: "The confirmation before deleting a rule (here a demo rule).",
  },
  {
    control:
      "paragraph: Its events stop going to the endpoint. Past deliveries stay in the log.",
    does: "Says what deleting changes.",
  },
  {
    control: "button: Keep it",
    does: "Closes the confirmation without deleting.",
  },
  {
    control: "button: Delete",
    does: "Deletes the rule.",
    operationIds: ["deleteWebhooksRulesByRuleId"],
  },
  {
    control: "alert: Could not load the rules. Try again",
    does: "Shown when the rules could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the rules.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the rules again.",
    operationIds: ["getWebhooksRules"],
  },
];

const ruleEditorEntries: DeeperEntry[] = [
  { control: "heading: Add a rule", does: "The new rule editor." },
  {
    control: "heading: Support inbox to Laravel",
    does: "The rule open in the editor (here a demo rule).",
  },
  {
    control:
      "paragraph: Which events go to the endpoint, and only when the filter matches.",
    does: "Explains the editor.",
  },
  { control: "textbox: Name", does: "The rule's name." },
  {
    control: "combobox: Endpoint",
    does: "The endpoint matching events are delivered to.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "heading: Events",
    does: "The events the rule sends; tick one or more.",
  },
  ...eventDescriptions.map(([eventType, eventDescription]): DeeperEntry => ({
    control: `checkbox: ${eventType}`,
    does: `Sends \`${eventType}\`, fired when ${eventDescription}.`,
  })),
  {
    control: "heading: Filter",
    does: "Conditions on the event's fields; with none, every selected event is sent.",
    links:
      "[Advanced: rules and filters](../../advanced/rules-and-filters.md).",
  },
  {
    control: "button: Negate filter",
    does: "Sends the events that do not match the filter instead.",
  },
  {
    control: "combobox: Filter combinator",
    does: "Whether all conditions must match, or any one.",
  },
  {
    control: "paragraph: No conditions: every selected event fires.",
    does: "Shown while the filter is empty.",
  },
  {
    control: "button: Negate condition #",
    does: "Turns that one condition around.",
  },
  {
    control: "combobox: Field #",
    does: "The event field the condition reads, such as `data.to[0].address` or `data.subject`.",
  },
  { control: "button: Remove condition #", does: "Removes the condition." },
  {
    control: "combobox: Operator #",
    does: "How the field is compared: equals, contains, matches a pattern, is in a list, and so on.",
  },
  { control: "textbox: Value #", does: "What the field is compared with." },
  { control: "button: Add condition", does: "Adds a condition." },
  {
    control: "button: Add group",
    does: "Adds a group of conditions with its own all or any.",
  },
  {
    control: "heading: Preview",
    does: "Tries the rule on recent real messages before you save it.",
    operationIds: ["postWebhooksRulesPreview"],
  },
  {
    control: "paragraph: Matches # of the last # messages",
    does: "How many recent messages the rule would send.",
  },
  {
    control: "switch: Show non-matching",
    does: "Lists the recent messages that would not be sent too, with the condition that failed.",
  },
  { control: "img: Matches", does: "Marks a recent message the rule matches." },
  {
    control: "paragraph: No recent message matches.",
    does: "Shown when none of the recent messages would be sent.",
  },
  { control: "button: Cancel", does: "Closes the editor without saving." },
  {
    control: "button: Add rule",
    state: "New rule editor",
    does: "Adds the rule; it applies to the next event.",
    operationIds: ["postWebhooksRules"],
  },
  {
    control: "button: Save changes",
    does: "Saves the rule; it applies to the next event.",
    operationIds: ["patchWebhooksRulesByRuleId"],
  },
  { control: "button: Close", does: "Closes the editor without saving." },
];

/** Webhooks > Rules: which events go to which endpoint, and the rule editor. */
export const webhooksRulesPage: DeeperPage = {
  screen: "/webhooks/rules",
  file: "webhooks/rules.md",
  title: "Rules in depth",
  description:
    "Every control and text of Webhooks > Rules and the rule editor.",
  guidePage: "webhooks/rules.md",
  guideTitle: "Rules",
  intro:
    "Webhooks > Rules decides which events go to which endpoint: each rule picks events and, optionally, a filter on their fields.",
  entries: [...ruleListEntries, ...ruleEditorEntries],
};
