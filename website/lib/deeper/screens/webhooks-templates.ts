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
