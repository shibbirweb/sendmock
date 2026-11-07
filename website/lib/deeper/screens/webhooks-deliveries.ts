import type { DeeperEntry, DeeperPage } from "../deeper-types";

const deliveryListEntries: DeeperEntry[] = [
  {
    control: "heading: Deliveries",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Deliveries guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Deliveries](../../webhooks/deliveries.md).",
  },
  {
    control: "heading: Webhook deliveries",
    does: "Every request SendMock sent to your endpoints, newest first, updated live.",
    operationIds: ["getWebhooksDeliveries"],
  },
  {
    control:
      "paragraph: Every request SendMock sent to your endpoints, live, with replay and retry controls.",
    does: "Explains the screen.",
  },
  { control: "button: All", does: "Shows every delivery." },
  {
    control: "button: Succeeded",
    does: "Shows deliveries your endpoint answered 2xx.",
  },
  {
    control: "button: Failed",
    does: "Shows deliveries that failed every attempt, or could not be rendered.",
  },
  {
    control: "button: Pending",
    does: "Shows deliveries waiting for their first try or a retry.",
  },
  {
    control: "combobox: Endpoint filter",
    does: "Shows one endpoint's deliveries, or all.",
  },
  {
    control: "combobox: Event filter",
    does: "Shows deliveries of one event type, or all.",
  },
  { control: "columnheader: Time", does: "When the delivery was made." },
  {
    control: "columnheader: Event",
    does: "The event it carried, such as `email.received`.",
  },
  { control: "columnheader: Endpoint", does: "Where it went." },
  {
    control: "columnheader: Trigger",
    does: "What started it: a rule, a test, a manual send, a replay or a saved delivery.",
  },
  {
    control: "columnheader: Status",
    does: "Succeeded, failed, retrying, pending, canceled, exhausted or render failed, with the HTTP status.",
  },
  {
    control: "columnheader: Duration",
    does: "How long the endpoint took to answer.",
  },
  {
    control: "columnheader: Attempt",
    does: "Which attempt this is, of the endpoint's maximum.",
  },
  {
    control: "each item, link: …",
    does: "Opens the delivery: its request, its answer and every attempt.",
    operationIds: ["getWebhooksDeliveriesByDeliveryId"],
  },
  {
    control: "button: Load more",
    does: "Loads the next page of older deliveries.",
  },
  {
    control: "paragraph: No deliveries yet",
    does: "Shown when no webhook has been delivered yet.",
  },
  {
    control:
      "paragraph: Deliveries appear here when a rule sends an event to an endpoint, or when you send a test from Endpoints.",
    does: "Explains how deliveries start.",
    links:
      "[Rules](../../webhooks/rules.md), [Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "alert: Could not load the deliveries. Try again",
    does: "Shown when the deliveries could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the deliveries.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the deliveries again.",
    operationIds: ["getWebhooksDeliveries"],
  },
];

const deliveryDetailEntries: DeeperEntry[] = [
  { control: "heading: Delivery", does: "The delivery drawer." },
  {
    control:
      "paragraph: The request SendMock sent and what your endpoint answered.",
    does: "Explains the drawer.",
  },
  {
    control: "link: Your Acme verification code is #. It expires in # minutes.",
    does: "The message the delivery is about (here an SMS); opens it.",
  },
  {
    control: "button: Copy as cURL",
    does: "Copies the request as a curl command, to run it yourself.",
  },
  {
    control: "button: Replay",
    does: "Sends the same request again, as it was, as a new delivery.",
    changes: "Records a replay delivery, linked to this one.",
    operationIds: ["postWebhooksDeliveriesByDeliveryIdReplay"],
  },
  {
    control: "button: Edit and replay",
    does: "Opens the request in an editor, then sends your changed copy as a new delivery.",
    operationIds: ["postWebhooksDeliveriesByDeliveryIdReplay"],
  },
  {
    control: "button: Save",
    does: "Keeps the request as a saved delivery, which survives pruning and reset.",
    links: "[Saved](../../webhooks/composer-and-saved.md).",
    operationIds: ["postWebhooksSaved"],
  },
  { control: "heading: Request POST", does: "The request's method and URL." },
  {
    control: "heading: Request headers",
    does: "The headers sent, signature included.",
  },
  { control: "heading: Request body", does: "The body sent." },
  { control: "button: Copy request body", does: "Copies the request body." },
  {
    control: "heading: Response #",
    does: "Your endpoint's HTTP status and how long it took.",
  },
  {
    control: "heading: Response headers",
    does: "The headers your endpoint answered with.",
  },
  { control: "heading: Response body", does: "What your endpoint answered." },
  { control: "button: Copy response body", does: "Copies the response body." },
  { control: "button: Close", does: "Closes the drawer." },
];

/** Webhooks > Deliveries: every request sent to an endpoint, with replay. */
export const webhooksDeliveriesPage: DeeperPage = {
  screen: "/webhooks/deliveries",
  file: "webhooks/deliveries.md",
  title: "Deliveries in depth",
  description:
    "Every control and text of Webhooks > Deliveries and a delivery's drawer.",
  guidePage: "webhooks/deliveries.md",
  guideTitle: "Deliveries",
  intro:
    "Webhooks > Deliveries lists every request SendMock sent to your endpoints, with what each answered, and replays any of them.",
  entries: [...deliveryListEntries, ...deliveryDetailEntries],
};
