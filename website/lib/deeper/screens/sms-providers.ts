import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { buildProviderEditorSetupEntries } from "./provider-editor-entries";
import { buildProviderEditorResponseEntries } from "./provider-editor-response-entries";
import { buildProviderListEntries } from "./provider-list-entries";

const smsProviderArea = {
  messageWord: "SMS",
  operationArea: "Sms",
  areaTitle: "SMS",
  menuTitle: "SMS",
  guidePage: "sms/providers.md",
} as const;

/** What only Twilio, the provider the crawl opens, shows. */
const twilioEntries: DeeperEntry[] = [
  {
    control: "heading: Twilio",
    does: "The provider open in the editor (here Twilio).",
  },
  {
    control: "paragraph: Built-in Key twilio , # messages in the last # hours.",
    does: "Says whether the provider is built in or your own, its key, and how many SMS it took in the last 24 hours.",
  },
  {
    control: "button: Reveal account_sid",
    does: "Shows the Account SID once, after you confirm.",
    operationIds: ["getSmsProvidersByProviderKeyCredentialsByCredentialName"],
  },
  {
    control: "button: Reveal auth_token",
    does: "Shows the Auth Token once, after you confirm.",
    operationIds: ["getSmsProvidersByProviderKeyCredentialsByCredentialName"],
  },
  {
    control: "textbox: queued",
    does: "The provider's name for a message waiting to be sent, as its status callbacks show it.",
  },
  {
    control: "textbox: sent",
    does: "The provider's name for a message handed to the carrier, as its status callbacks show it.",
  },
  {
    control: "textbox: delivered",
    does: "The provider's name for a message delivered, as its status callbacks show it.",
  },
  {
    control: "textbox: undelivered",
    does: "The provider's name for a message not delivered, as its status callbacks show it.",
  },
  {
    control: "textbox: failed",
    does: "The provider's name for a message failed to send, as its status callbacks show it.",
  },
  {
    control: "textbox: read",
    does: "The provider's name for a message read, as its status callbacks show it.",
  },
  {
    control:
      "paragraph: The provider's error code for each outcome, so the magic test numbers fail with its own codes. Leave one empty to use none.",
    does: "Explains the error codes below.",
    links: "[Magic numbers and addresses](../../reference/magic-numbers.md).",
  },
  {
    control: "textbox: invalid_number",
    does: "The provider's error code for an invalid number (Twilio's own is `21211`).",
  },
  {
    control: "textbox: cannot_route",
    does: "The provider's error code for a number it cannot route to (Twilio's own is `21612`).",
  },
  {
    control: "textbox: no_international_permission",
    does: "The provider's error code for no international permission (Twilio's own is `21408`).",
  },
  {
    control: "textbox: blocked",
    does: "The provider's error code for a blocked (opted out) number (Twilio's own is `21610`).",
  },
  {
    control: "textbox: cannot_receive_sms",
    does: "The provider's error code for a number that cannot receive SMS (Twilio's own is `21614`).",
  },
  {
    control: "textbox: invalid_from",
    does: "The provider's error code for an invalid sender (Twilio's own is `21212`).",
  },
  {
    control: "textbox: not_sms_capable",
    does: "The provider's error code for a sender that is not SMS capable (Twilio's own is `21606`).",
  },
  {
    control: "textbox: queue_full",
    does: "The provider's error code for a full message queue (Twilio's own is `21611`).",
  },
  {
    control: "textbox: unreachable_handset",
    does: "The provider's error code for an unreachable handset (Twilio's own is `30003`).",
  },
  {
    control: "textbox: landline",
    does: "The provider's error code for a landline or unreachable carrier (Twilio's own is `30006`).",
  },
  {
    control: "textbox: carrier_filtered",
    does: "The provider's error code for a message the carrier filtered (Twilio's own is `30007`).",
  },
  {
    control: "textbox: unknown_error",
    does: "The provider's error code for an unknown error (Twilio's own is `30008`).",
  },
];

/** SMS > Providers: the SMS APIs SendMock answers, and the provider editor. */
export const smsProvidersPage: DeeperPage = {
  screen: "/sms/providers",
  file: "sms/providers.md",
  title: "SMS providers in depth",
  description:
    "Every control and text of SMS > Providers, the provider editor and its tabs.",
  guidePage: "sms/providers.md",
  guideTitle: "SMS > Providers",
  intro:
    "SMS > Providers lists the SMS APIs SendMock answers like the real provider. The editor changes how each one reads requests, what it answers and the codes it reports.",
  entries: [
    ...buildProviderListEntries(smsProviderArea),
    ...twilioEntries,
    ...buildProviderEditorSetupEntries(smsProviderArea),
    ...buildProviderEditorResponseEntries(smsProviderArea),
  ],
};
