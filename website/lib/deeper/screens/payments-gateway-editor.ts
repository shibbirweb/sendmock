import type { DeeperEntry } from "../deeper-types";

const gatewayEvents = [
  "payment.created",
  "payment.authorized",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
  "payment.refunded",
  "payment.partially_refunded",
  "payment.dispute_opened",
  "payment.dispute_updated",
  "payment.dispute_closed",
  "checkout.completed",
  "checkout.expired",
];

/** The gateway editor's tabs. */
export const gatewayEditorEntries: DeeperEntry[] = [
  {
    control: "heading: Stripe",
    does: "The gateway open in the editor (here Stripe).",
  },
  {
    control: "paragraph: Built-in gateway, key stripe . # payments.",
    does: "Whether it is built in, its key and how many payments it has.",
  },
  { control: "tab: General", does: "Name, key, colour and whether it is on." },
  {
    control: "tab: Checkout",
    does: "The methods its checkout page offers, and a test checkout.",
  },
  {
    control: "tab: Merchant",
    does: "Its merchant credentials and where its notifications go.",
  },
  {
    control: "tab: Redirect",
    does: "How the customer is sent back to your app, and with which fields.",
  },
  {
    control: "tab: Notification",
    does: "The notification it posts to your app: format, event names, body and headers.",
  },
  {
    control:
      "paragraph: The provider value in the API and in /providers/<key>/... paths; fixed once added.",
    does: "Explains the key.",
  },
  {
    control: "textbox: Accent colour",
    does: "Picks the checkout page's colour.",
  },
  { control: "textbox: Accent", does: "The colour as a hex value." },
  {
    control: "paragraph: Used on its checkout pages.",
    does: "Explains the accent.",
  },
  { control: "switch: Enabled", does: "Whether the gateway takes payments." },
  {
    control: "button: Reset to default",
    does: "Brings back the shipped definition of a built-in, after you confirm.",
    operationIds: ["postPaymentsGatewaysByGatewayKeyReset"],
  },
  {
    control: "button: Save gateway",
    does: "Saves the gateway; the next payment uses it.",
    errors: "A template with errors is refused with the reason.",
    operationIds: ["patchPaymentsGatewaysByGatewayKey"],
  },
  {
    control: "heading: Methods offered",
    does: "The methods its checkout page offers, in order.",
  },
  {
    control:
      "paragraph: One method shows its flow directly; several show a picker, in this order.",
    does: "Explains how the checkout page shows the methods.",
  },
  {
    control: "button: Move Card up",
    does: "Shows the method earlier (here Card).",
  },
  { control: "button: Move Card down", does: "Shows the method later." },
  { control: "button: Remove Card", does: "Stops offering the method." },
  {
    control: "combobox: Add a method",
    does: "Offers another method.",
    links: "[Methods](../../payments/methods.md).",
  },
  {
    control:
      "paragraph: Creates a test payment with this gateway and opens its checkout page.",
    does: "Explains Open a test checkout.",
  },
  {
    control: "button: Open a test checkout",
    does: "Creates a test payment and opens its checkout page.",
    operationIds: ["postPaymentsCheckout"],
  },
  {
    control:
      "paragraph: Templates read them as merchant.<name> . Secrets stay masked; the preview masks them too.",
    does: "Explains the merchant credentials.",
  },
  {
    control: "textbox: Credential # name",
    does: "A credential's name, such as `secret_key`.",
  },
  {
    control: "textbox: Credential # value",
    does: "Its value; a secret one is masked.",
  },
  { control: "checkbox: Secret", does: "Masks the value everywhere." },
  {
    control: "button: Reveal secret_key",
    does: "Shows the secret key once, after you confirm.",
    operationIds: [
      "getPaymentsGatewaysByGatewayKeyCredentialsByCredentialName",
    ],
  },
  {
    control: "button: Reveal webhook_secret",
    does: "Shows the webhook signing secret once, after you confirm.",
    operationIds: [
      "getPaymentsGatewaysByGatewayKeyCredentialsByCredentialName",
    ],
  },
  { control: "button: Remove credential #", does: "Removes the credential." },
  { control: "button: Add credential", does: "Adds a credential." },
  {
    control: "combobox: Notification endpoint",
    does: "The webhook endpoint its notifications go to.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control:
      "paragraph: Its IPN or webhook deliveries go to this webhook endpoint, with retries and replay.",
    does: "Explains the notification endpoint.",
  },
  {
    control: "radio: GET The fields go in the query string (Stripe, PayPal).",
    does: "The customer returns with a GET, the fields in the query string.",
  },
  {
    control:
      "radio: POST The browser posts a form with the fields (SSLCommerz).",
    does: "The customer's browser posts a form back to your app.",
  },
  {
    control:
      "paragraph: Type {{ for suggestions; {{ redirect.status }} is this gateway's event name for the outcome.",
    does: "Explains the redirect field templates.",
  },
  {
    control: "textbox: Redirect field # name",
    does: "A redirect field's name.",
  },
  {
    control: "textbox: Redirect field # template",
    does: "Its value template.",
  },
  {
    control: "combobox: Redirect field # sent",
    does: "When it is sent: always, or only on success or failure.",
  },
  { control: "button: Remove redirect field #", does: "Removes the field." },
  { control: "button: Add field", does: "Adds a redirect field." },
  {
    control: "tab: Preview",
    does: "Shows the redirect and notification as they would be sent.",
  },
  {
    control: "tab: Reference",
    does: "Lists every value the templates can read.",
  },
  {
    control: "combobox: Preview payment",
    does: "The payment the preview uses.",
  },
  {
    control: "combobox: Preview event",
    does: "The event the preview renders.",
  },
  {
    control: "combobox: Preview redirect outcome",
    does: "The outcome the preview's redirect shows.",
    operationIds: ["postPaymentsGatewaysByGatewayKeyPreview"],
  },
  { control: "heading: Redirect", does: "The redirect as it would be sent." },
  {
    control: "paragraph: GET http://localhost:#/checkout/success",
    does: "The redirect's method and URL (here a GET to the demo app).",
  },
  {
    control: "heading: Notification",
    does: "The notification as it would be sent.",
  },
  {
    control: "paragraph: payment_intent.succeeded",
    does: "The gateway's event name for the preview event (here Stripe's).",
  },
  {
    control: "radio: JSON application/json (Stripe, PayPal, bKash).",
    does: "The notification body is JSON.",
  },
  {
    control:
      "radio: Form application/x-www-form-urlencoded; write the body as name=value&... (SSLCommerz IPN).",
    does: "The notification body is a form.",
  },
  {
    control:
      "paragraph: This gateway's name for each event, read as {{ event.name }} . Leave one blank and nothing is sent for it.",
    does: "Explains the event names.",
  },
  ...gatewayEvents.map((eventType): DeeperEntry => ({
    control: `textbox: Event name for ${eventType}`,
    does: `The gateway's own name for \`${eventType}\`; blank sends nothing for it.`,
  })),
  {
    control: "textbox: Notification body template",
    does: "The notification body, in the template language.",
  },
  { control: "textbox: Header # name", does: "A notification header's name." },
  {
    control: "textbox: Header # value",
    does: "Its value template, such as a signature.",
  },
  { control: "button: Remove header #", does: "Removes the header." },
  { control: "button: Add header", does: "Adds a header." },
];
