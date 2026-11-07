import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { buildProviderEditorSetupEntries } from "./provider-editor-entries";
import { buildProviderEditorResponseEntries } from "./provider-editor-response-entries";

const emailProviderArea = {
  messageWord: "email",
  operationArea: "Emails",
} as const;

const mailProvidersListEntries: DeeperEntry[] = [
  {
    control: "heading: Providers",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Providers guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Mail > Providers](../../mail/providers.md).",
  },
  {
    control: "heading: Email providers",
    does: "The list of email APIs SendMock answers.",
    operationIds: ["getEmailsProviders"],
  },
  {
    control:
      "paragraph: The email APIs SendMock answers like the real provider. Change a built-in, remove the ones you do not use, or add your own.",
    does: "Explains the screen.",
  },
  {
    control: "button: Add provider",
    does: "Opens Add a provider, or (in the dialog) adds it and opens its editor.",
    operationIds: ["postEmailsProviders"],
  },
  {
    control: "columnheader: Provider",
    does: "The provider's name and whether it is built in, modified or your own.",
  },
  {
    control: "columnheader: Key",
    does: "Its key: the `/providers/<key>/` path and the source stored on its emails.",
  },
  {
    control: "columnheader: Last # hours",
    does: "How many emails it took in the last 24 hours.",
  },
  {
    control: "columnheader: Enabled",
    does: "Whether it answers requests.",
  },
  {
    control: "each item, switch: … enabled",
    does: "Turns the provider on or off at once; while off, its paths answer 404.",
    operationIds: ["patchEmailsProvidersByProviderKey"],
  },
  {
    control: "each item, button: …",
    does: "Opens the provider's editor.",
    operationIds: ["getEmailsProvidersByProviderKey"],
  },
  {
    control: "heading: Add a provider",
    does: "The Add a provider dialog.",
  },
  {
    control:
      "paragraph: Answer a provider SendMock does not ship, from blank or from the closest email provider; you set its requests and responses next.",
    does: "Explains what adding does.",
    links:
      "[Advanced: create an email provider](../../advanced/email-provider.md).",
  },
  {
    control: "combobox: Start from",
    does: "Blank, or a built-in to copy as the starting point.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog or editor without saving.",
  },
  {
    control: "button: Close",
    does: "Closes the dialog or editor without saving.",
  },
  {
    control: "heading: SendGrid",
    does: "The provider open in the editor (here SendGrid).",
  },
  {
    control:
      "paragraph: Built-in Key sendgrid , # messages in the last # hours.",
    does: "Says whether the provider is built in or your own, its key, and how many emails it took in the last 24 hours.",
  },
  {
    control: "button: Reveal api_key",
    does: "Shows the secret value once, after you confirm.",
    operationIds: [
      "getEmailsProvidersByProviderKeyCredentialsByCredentialName",
    ],
  },
  {
    control: "textbox: delivered",
    does: "The provider's name for a delivered email, as its event webhooks show it.",
  },
  {
    control: "textbox: bounced",
    does: "Its name for a bounce.",
  },
  {
    control: "textbox: complained",
    does: "Its name for a spam complaint.",
  },
  {
    control: "textbox: opened",
    does: "Its name for an open.",
  },
  {
    control: "alert: Could not load the providers. Try again",
    does: "Shown when the list could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the providers.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the list again.",
    operationIds: ["getEmailsProviders"],
  },
];

/** Mail > Providers: the email APIs SendMock answers, and the provider editor. */
export const mailProvidersPage: DeeperPage = {
  screen: "/mail/providers",
  file: "mail/providers.md",
  title: "Email providers in depth",
  description:
    "Every control and text of Mail > Providers, the provider editor and its tabs.",
  guidePage: "mail/providers.md",
  guideTitle: "Mail > Providers",
  intro:
    "Mail > Providers lists the email APIs SendMock answers like the real provider. The editor changes how each one reads requests and what it answers.",
  entries: [
    ...mailProvidersListEntries,
    ...buildProviderEditorSetupEntries(emailProviderArea),
    ...buildProviderEditorResponseEntries(emailProviderArea),
  ],
};
