import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { buildProviderEditorSetupEntries } from "./provider-editor-entries";
import { buildProviderEditorResponseEntries } from "./provider-editor-response-entries";
import { buildProviderListEntries } from "./provider-list-entries";

const emailProviderArea = {
  messageWord: "email",
  operationArea: "Emails",
  areaTitle: "Email",
  menuTitle: "Mail",
  guidePage: "mail/providers.md",
} as const;

/** What only SendGrid, the provider the crawl opens, shows. */
const sendGridEntries: DeeperEntry[] = [
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
    ...buildProviderListEntries(emailProviderArea),
    ...sendGridEntries,
    ...buildProviderEditorSetupEntries(emailProviderArea),
    ...buildProviderEditorResponseEntries(emailProviderArea),
  ],
};
