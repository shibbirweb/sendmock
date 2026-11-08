import type { DeeperEntry, DeeperPage } from "../deeper-types";

const variableKinds: [string, string][] = [
  ["Text A fixed piece of text, e.g. a tenant id.", "A fixed text value."],
  ["Number A fixed number, sent unquoted in fields.", "A fixed number."],
  ["Boolean true or false.", "`true` or `false`."],
  ["JSON A fixed object or list.", "A fixed JSON object or list."],
  [
    "Secret A token or key: masked everywhere, never shown again.",
    "A secret, masked in the UI, the API, logs, MCP and seed exports.",
  ],
  [
    "Dynamic Read from the event, e.g. data.to[#].address | lower.",
    "An expression on the event, such as the first recipient in lower case.",
  ],
  [
    "Random Generated per send or once, e.g. random_string(#).",
    "A random value, new for each send or made once.",
  ],
  [
    "Computed A template made of other variables.",
    "A template that combines other variables.",
  ],
  [
    "Prompt Asked for on manual sends; the default is used otherwise.",
    "Asked for when you send by hand; the default is used for rule deliveries.",
  ],
];

const variableEntries: DeeperEntry[] = [
  {
    control: "heading: Variables",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Variables guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Variables](../../webhooks/variables.md).",
  },
  {
    control: "heading: Webhook variables",
    does: "Values templates read as `{{ vars.name }}`.",
    operationIds: ["getWebhooksVariables"],
  },
  {
    control:
      "paragraph: Values templates read as {{ vars.name }}: endpoint ones win over global ones.",
    does: "Explains the screen and which value wins.",
  },
  {
    control: "button: Add variable",
    does: "Opens the variable editor; in it, adds the variable.",
    operationIds: ["postWebhooksVariables"],
  },
  { control: "textbox: Search variables", does: "Filters by name." },
  {
    control: "combobox: Scope filter",
    does: "Shows global variables, one endpoint's, or all.",
  },
  { control: "button: All kinds", does: "Shows every kind." },
  ...[
    "Text",
    "Number",
    "Boolean",
    "JSON",
    "Secret",
    "Dynamic",
    "Random",
    "Computed",
    "Prompt",
  ].map((kindName): DeeperEntry => ({
    control: `button: ${kindName}`,
    does: `Shows only ${kindName} variables.`,
  })),
  { control: "columnheader: Name", does: "The variable's name." },
  { control: "columnheader: Kind", does: "Its kind." },
  {
    control: "columnheader: Value",
    does: "Its value, or a sample of what it resolves to; secrets are masked.",
  },
  {
    control: "columnheader: Scope",
    does: "Global, or the endpoint it belongs to.",
  },
  { control: "columnheader: Actions", does: "Edit and Delete." },
  { control: "each item, button: …", does: "Opens the variable's editor." },
  {
    control: "each item, button: Delete idempotency_seed",
    does: "Deletes the variable after you confirm (here a demo variable).",
    operationIds: ["deleteWebhooksVariablesByVariableId"],
  },
  { control: "heading: Add a variable", does: "The new variable editor." },
  {
    control: "heading: vars.tenant_id",
    does: "The variable open in the editor (here a demo variable).",
  },
  {
    control: "paragraph: A value templates read as {{ vars.name }}.",
    does: "Explains the editor.",
  },
  { control: "textbox: Name", does: "The name templates use after `vars.`." },
  {
    control: "paragraph: Used as {{ vars.name }}.",
    does: "How a template reads it.",
  },
  {
    control: "combobox: Scope",
    does: "Global, or one endpoint; an endpoint's wins over a global one of the same name.",
  },
  ...variableKinds.map(([radioName, kindDescription]): DeeperEntry => ({
    control: `radio: ${radioName}`,
    does: kindDescription,
  })),
  {
    control: "textbox: Value",
    does: "The value, expression or template, by kind.",
  },
  {
    control: "heading: Resolves to, with the sample email",
    does: "What the variable gives for the sample email.",
    operationIds: ["postWebhooksVariablesPreview"],
  },
  {
    control: "textbox: Description",
    does: "A note on what the variable is for.",
  },
  { control: "button: Cancel", does: "Closes the editor without saving." },
  {
    control: "button: Add variable",
    state: "New variable editor",
    does: "Adds the variable.",
    operationIds: ["postWebhooksVariables"],
  },
  {
    control: "button: Save changes",
    does: "Saves the variable.",
    operationIds: ["patchWebhooksVariablesByVariableId"],
  },
  { control: "button: Close", does: "Closes the editor without saving." },
  {
    control: "alert: Could not load the variables. Try again",
    does: "Shown when the variables could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the variables.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getWebhooksVariables"],
  },
];

/** Webhooks > Variables: values templates read. */
export const webhooksVariablesPage: DeeperPage = {
  screen: "/webhooks/variables",
  file: "webhooks/variables.md",
  title: "Variables in depth",
  description:
    "Every control and text of Webhooks > Variables and the variable editor.",
  guidePage: "webhooks/variables.md",
  guideTitle: "Variables",
  intro:
    "Webhooks > Variables holds the values templates read as `{{ vars.name }}`.",
  entries: variableEntries,
};
