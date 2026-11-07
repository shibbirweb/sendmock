import type { DeeperEntry, DeeperPage } from "../deeper-types";

const templateEntries: DeeperEntry[] = [
  {
    control: "heading: Templates",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Templates guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Templates](../../webhooks/templates.md).",
  },
  {
    control: "heading: Webhook templates",
    does: "Every payload format an endpoint can send.",
    operationIds: ["getWebhooksTemplates"],
  },
  {
    control:
      "paragraph: Payload formats your endpoints can send: SendMock's own JSON, providers your app already parses, chat tools, and your own.",
    does: "Explains the screen.",
    links:
      "[Built-in webhook templates](../../reference/webhook-templates.md).",
  },
  {
    control: "button: Import",
    does: "Opens Import a template; in the dialog, imports it.",
    operationIds: ["postWebhooksTemplatesImport"],
  },
  { control: "button: New template", does: "Opens New template." },
  { control: "tab: All", does: "Every template." },
  { control: "tab: Generic", does: "SendMock's native JSON." },
  {
    control: "tab: Email providers",
    does: "Templates that act like an email provider's webhooks.",
  },
  {
    control: "tab: SMS providers",
    does: "Templates that act like an SMS provider's callbacks.",
  },
  {
    control: "tab: Payment gateways",
    does: "Templates that act like a payment gateway's notifications.",
  },
  {
    control: "tab: Chat",
    does: "Slack, Discord, Teams, Google Chat and Telegram messages.",
  },
  {
    control: "tab: Automation",
    does: "A flat JSON format for n8n, Zapier and Make.",
  },
  {
    control: "tab: Custom",
    does: "Your own templates and those loaded from a templates folder.",
  },
  { control: "textbox: Search templates", does: "Filters by name or service." },
  {
    control: "combobox: Event filter",
    does: "Shows only templates that fit an event.",
  },
  {
    control: "each item, link: …",
    does: "A template card: its service, name and events, with Modified or From file badges; opens it.",
    operationIds: ["getWebhooksTemplatesByTemplateId"],
  },
  {
    control: "heading: Native SendMock JSON",
    does: "The template open in the drawer (here SendMock's native JSON).",
  },
  {
    control: "paragraph: SendMock · Built-in · revision #",
    does: "Its service, whether it is built in, modified or yours, and its revision.",
  },
  {
    control: "link: Use in new endpoint",
    does: "Opens the new endpoint editor with this template chosen.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "button: Edit",
    does: "Opens the template editor; a built-in becomes Modified, and Reset to default brings it back.",
    operationIds: ["patchWebhooksTemplatesByTemplateId"],
  },
  {
    control: "button: Clone",
    does: "Makes your own copy of the template.",
    operationIds: ["postWebhooksTemplatesByTemplateIdClone"],
  },
  {
    control: "button: Export",
    does: "Downloads the template as a `.sendmock-template.toml` file.",
    operationIds: ["getWebhooksTemplatesByTemplateIdExport"],
  },
  {
    control:
      "paragraph: Native SendMock JSON payload, matching the provider's documented format.",
    does: "The template's description.",
  },
  {
    control: "heading: Body template",
    does: "The template's body, in the template language.",
  },
  {
    control: "combobox: Preview with",
    does: "The event the preview renders: a sample, or a recent real message.",
    operationIds: ["postWebhooksTemplatesByTemplateIdRender"],
  },
  {
    control: "heading: Rendered headers",
    does: "The headers it renders, signature included.",
  },
  { control: "heading: Rendered body", does: "The body it renders." },
  { control: "button: Copy rendered body", does: "Copies the rendered body." },
  { control: "button: Close", does: "Closes the drawer or dialog." },
  {
    control: "heading: Import a template",
    does: "The Import a template dialog.",
  },
  {
    control:
      "paragraph: A .sendmock-template.toml or JSON file exported from SendMock, or its text.",
    does: "Explains what can be imported.",
  },
  {
    control: "button: File",
    does: "Reads a template file from your computer.",
  },
  {
    control: "textbox: Template text",
    does: "The template file's text, pasted.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog without doing anything.",
  },
  { control: "heading: New template", does: "The New template dialog." },
  {
    control:
      "paragraph: It starts as SendMock's native JSON; change it in the editor that opens next.",
    does: "Explains where a new template starts.",
  },
  { control: "textbox: Name", does: "The name." },
  {
    control: "button: Create",
    does: "Creates the template and opens its editor.",
    operationIds: ["postWebhooksTemplates"],
  },
  {
    control: "alert: Could not load the templates. Try again",
    does: "Shown when the templates could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the templates.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getWebhooksTemplates"],
  },
];

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

/** Webhooks > Templates: payload formats. */
export const webhooksTemplatesPage: DeeperPage = {
  screen: "/webhooks/templates",
  file: "webhooks/templates.md",
  title: "Templates in depth",
  description:
    "Every control and text of Webhooks > Templates, a template and its dialogs.",
  guidePage: "webhooks/templates.md",
  guideTitle: "Templates",
  intro:
    "Webhooks > Templates holds every payload format an endpoint can send, built in or your own.",
  entries: templateEntries,
};

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
