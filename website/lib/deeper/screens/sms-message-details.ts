import type { DeeperEntry } from "../deeper-types";

/** SMS: a message's menu and its Message details drawer. */
export const smsMessageDetailEntries: DeeperEntry[] = [
  {
    control: "menuitem: Message details",
    does: "Opens the drawer with the message's status history, its original request and its callbacks or reply webhook.",
    operationIds: ["getSmsBySmsId"],
  },
  {
    control: "menuitem: Simulate read",
    does: "Records that the recipient read the message, as WhatsApp read receipts do.",
    changes: "Fires `sms.opened` and sends a `read` status callback.",
    operationIds: ["postSmsBySmsIdOpen"],
  },
  {
    control: "menuitem: Send to webhook",
    does: "Opens the Send to webhook dialog, to deliver this message's event to an endpoint now.",
    operationIds: ["postWebhooksEndpointsByEndpointIdSend"],
  },
  { control: "menuitem: Copy text", does: "Copies the message text." },
  {
    control: "menuitem: Copy message ID",
    does: "Copies the message's id (Twilio's `SM...` SID for Twilio messages).",
  },
  {
    control: "menuitem: Delete",
    does: "Deletes the message at once; a notice confirms it.",
    operationIds: ["deleteSmsBySmsId"],
  },
  { control: "heading: Message details", does: "The Message details drawer." },
  {
    control:
      "paragraph: Status history, the original request and status callbacks.",
    does: "Explains what the drawer shows.",
  },
  {
    control: "paragraph: Your order ## has shipped.",
    does: "The message text (here the demo's shipping notice).",
  },
  {
    control: "link: Twilio",
    does: "The API the message came through; opens SMS > Providers.",
    links: "[SMS > Providers](../../sms/providers.md).",
  },
  {
    control: "button: Copy message ID",
    does: "Copies the message's id.",
  },
  {
    control: "heading: Set status",
    does: "Moves the message to a status by hand, as the carrier would report it.",
  },
  {
    control: "combobox: Error code for Undelivered and Failed",
    does: "The provider error code to report with Undelivered or Failed.",
  },
  {
    control: "button: Delivered",
    does: "Sets the message delivered.",
    changes: "Fires `sms.status` and sends the status callback to your app.",
    operationIds: ["postSmsBySmsIdStatus"],
  },
  {
    control: "button: Undelivered",
    does: "Sets the message undelivered with the chosen error code.",
    changes: "Fires `sms.status` and sends the status callback.",
    operationIds: ["postSmsBySmsIdStatus"],
  },
  {
    control: "button: Failed",
    does: "Sets the message failed with the chosen error code.",
    changes: "Fires `sms.status` and sends the status callback.",
    operationIds: ["postSmsBySmsIdStatus"],
  },
  {
    control: "tab: Status",
    does: "Every status the message went through, with the time of each.",
  },
  {
    control: "tab: Request",
    does: "The request your app sent to create the message, exactly as received.",
  },
  {
    control: "tab: Callbacks (#)",
    does: "Each status callback sent to your app: the URL, the request, the answer and retries.",
  },
  { control: "button: Close", does: "Closes the drawer or dialog." },
  {
    control: "button: Copy request JSON",
    does: "Copies the original request.",
  },
  {
    control: "link: Open in request log",
    does: "Opens the request in Logs > API requests.",
    links: "[Logs](../../logs.md).",
  },
  {
    control: "paragraph: Sent to http://localhost:#/sms/status",
    does: "The status callback URL your app gave with the message; each attempt is listed below it with the answer it got.",
  },
];
