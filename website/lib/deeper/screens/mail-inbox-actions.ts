import type { DeeperEntry } from "../deeper-types";

/** Mail: the reply and forward composers, the menus and the dialogs of an open email. */
export const mailInboxActionEntries: DeeperEntry[] = [
  {
    control: "heading: Reply as recipient",
    does: "The reply composer: you answer as the person the email was sent to.",
  },
  {
    control: "heading: Forward as recipient",
    does: "The forward composer: you forward the email as the person it was sent to.",
  },
  {
    control: "button: Close composer",
    does: "Closes the composer without sending.",
  },
  {
    control: "combobox: From",
    does: "Which recipient of the original email the reply or forward comes from.",
  },
  {
    control: "combobox: To",
    does: "Where the forward goes: an address your app receives mail on (an inbound domain or route).",
  },
  {
    control: "textbox: Subject",
    does: "The subject, prefilled with `Re:` or `Fwd:` and the original subject.",
  },
  {
    control: "checkbox: Include attachments (#)",
    does: "Forwards the original attachments too.",
  },
  {
    control: "button: Send reply",
    does: "Stores the reply as an incoming email with `In-Reply-To` and `References` set; a notice says it was created, with Open to read it.",
    changes:
      "Fires `email.inbound`; inbound routes deliver it to your app, as the provider would.",
    operationIds: ["postEmailsByEmailIdReply"],
  },
  {
    control: "button: Send forward",
    does: "Stores the forward as an incoming email; a notice says it was created, with Open to read it.",
    changes: "Fires `email.inbound` and runs the inbound routes.",
    operationIds: ["postEmailsByEmailIdForward"],
  },
  {
    control:
      "paragraph: Creates an incoming email ( email.inbound ). Inbound routes deliver it to your app.",
    does: "Explains what sending does.",
    links: "[Inbound routes](../../webhooks/inbound-routes.md).",
  },
  {
    control: "menuitem: Open (email.opened)",
    does: "Records an open of the email, as a tracking pixel would.",
    changes: "Fires `email.opened` with `first_open` and the open count.",
    operationIds: ["postEmailsByEmailIdOpen"],
  },
  {
    control: "menuitem: Click a link (email.clicked)",
    does: "Lists the email's links; choosing one records a click on it, as a provider's click tracking would. Shown when the email has links.",
    changes: "Fires `email.clicked` with the link, `first_click` and the click count, and adds it to the Timeline. A link clicked in the HTML preview does the same with `source: \"ui\"`.",
    operationIds: ["postEmailsByEmailIdClicks"],
  },
  {
    control: "menuitem: Delivered",
    does: "Marks the email delivered.",
    changes: "Fires `email.delivered` and adds it to the Timeline.",
    operationIds: ["postEmailsByEmailIdSimulate"],
  },
  {
    control: "menuitem: Hard bounce",
    does: "Bounces the email permanently (550 5.1.1).",
    changes: "Fires `email.bounced` with a permanent bounce type.",
    operationIds: ["postEmailsByEmailIdSimulate"],
  },
  {
    control: "menuitem: Soft bounce",
    does: "Defers the email, then bounces it as a temporary failure.",
    changes:
      "Fires `email.deferred`, then `email.bounced` with a transient bounce type.",
    operationIds: ["postEmailsByEmailIdSimulate"],
  },
  {
    control: "menuitem: Spam complaint",
    does: "Delivers the email, then records a complaint, as when the recipient marks it as spam.",
    changes: "Fires `email.delivered`, then `email.complained`.",
    operationIds: ["postEmailsByEmailIdSimulate"],
  },
  {
    control: "menuitem: Unsubscribe",
    does: "Records an unsubscribe from the email's list.",
    changes: "Fires `email.unsubscribed`.",
    operationIds: ["postEmailsByEmailIdSimulate"],
  },
  {
    control: "menuitem: Download .eml",
    does: "Downloads the raw message as an `.eml` file.",
    operationIds: ["getEmailsByEmailIdRaw"],
  },
  {
    control: "menuitem: Release to real SMTP",
    does: "Opens the Release dialog, to send this email to a real inbox through your relay.",
  },
  {
    control: "menuitem: Send to webhook",
    does: "Opens the Send to webhook dialog, to deliver this email's event to an endpoint now.",
  },
  {
    control: "heading: Release to real SMTP",
    does: "The Release dialog.",
  },
  {
    control:
      "paragraph: Sends this email through your relay server so you can check it in a real inbox. Only recipients on the relay allowlist are accepted.",
    does: "Explains what Release does and its safety rule.",
  },
  {
    control: "textbox: Recipients (comma separated)",
    does: "Who to send it to, prefilled with the original recipients.",
  },
  {
    control: "button: Release",
    does: "Sends the email through the relay SMTP server.",
    errors:
      "Refused until `--relay-smtp` and `--relay-allowlist` are set; a recipient outside the allowlist is refused by name.",
    links: "[Release](../../mail/release.md).",
    operationIds: ["postEmailsByEmailIdRelease"],
  },
  {
    control: "heading: Send to webhook",
    does: "The Send to webhook dialog.",
  },
  {
    control:
      'paragraph: Sends "Welcome to Acme: here is what is new this week" to an endpoint now.',
    does: "Names the email the webhook is about.",
  },
  {
    control: "combobox: Endpoint",
    does: "The webhook endpoint to send to.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "combobox: Format",
    does: "The template the request is rendered with: the endpoint's own, or another for this send only.",
  },
  {
    control: "paragraph: A template here is used for this send only.",
    does: "Explains that the endpoint keeps its template.",
  },
  {
    control: "textbox: vars.reason",
    does: "A variable the chosen template asks for on manual sends (here `reason`), filled in for this send.",
    links: "[Variables](../../webhooks/variables.md).",
  },
  {
    control: "paragraph: Asked for on manual sends.",
    does: "Explains why the variable is asked for.",
  },
  {
    control:
      "paragraph: None. A value here wins over the endpoint and global value of that name, for this send only.",
    does: "The variable overrides for this send; none yet.",
  },
  {
    control: "button: Add override",
    does: "Adds a variable value for this send only.",
  },
  {
    control: "switch: Edit body",
    does: "Lets you change the rendered body by hand before sending.",
  },
  {
    control: "button: Copy rendered URL",
    does: "Copies the URL the request goes to, after its template variables are filled in.",
  },
  {
    control: "heading: Rendered headers",
    does: "The headers the request will carry, signature included.",
  },
  {
    control: "heading: Rendered body",
    does: "The body the request will carry.",
  },
  {
    control: "button: Copy rendered body",
    does: "Copies the rendered body.",
  },
  {
    control: "button: Send",
    does: "Sends the request now and shows the delivery it made.",
    changes:
      "Records a delivery in Webhooks > Deliveries, retried by the endpoint's policy.",
    errors:
      "A template that does not render, or a required variable left empty, is refused with the reason.",
    operationIds: ["postWebhooksEndpointsByEndpointIdSend"],
  },
];
