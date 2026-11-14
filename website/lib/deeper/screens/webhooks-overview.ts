import type { DeeperEntry, DeeperPage } from "../deeper-types";

const overviewEntries: DeeperEntry[] = [
  {
    control: "heading: Webhooks",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Webhooks guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Webhooks](../../webhooks/index.md).",
  },
  {
    control: "heading: Webhooks overview",
    does: "The health of your webhook endpoints over the chosen time range.",
    operationIds: ["getWebhooksMetrics"],
  },
  {
    control:
      "paragraph: How your endpoints are doing: volume, success, latency and what fails.",
    does: "Explains the screen.",
  },
  {
    control: "radio: # hours",
    does: "Shows the last 24 hours, by hour.",
    operationIds: ["getWebhooksMetrics"],
  },
  {
    control: "radio: # days",
    does: "Shows the last 7 days, by day.",
    operationIds: ["getWebhooksMetrics"],
  },
  {
    control: "combobox: Endpoint",
    does: "Shows every endpoint together, or one alone.",
  },
  {
    control: "switch: Show as table",
    does: "Shows the deliveries chart as a table, one row per hour or day, for reading exact numbers.",
  },
  { control: "columnheader: Endpoint", does: "The endpoint's name." },
  {
    control: "columnheader: Deliveries",
    does: "How many deliveries it had in the range.",
  },
  {
    control: "columnheader: Success",
    does: "The share of deliveries that ended answered 2xx.",
  },
  {
    control: "columnheader: p# / p#",
    does: "The median (p50) and 95th percentile (p95) time your endpoint took to answer.",
  },
  {
    control: "columnheader: Retries",
    does: "How many attempts were retries after a failure.",
  },
  {
    control: "columnheader: Top failures",
    does: "The failure codes it got most, such as `500` or a timeout.",
  },
  {
    control: "each item, button: …",
    does: "The endpoint's name; shows only that endpoint on the screen.",
  },
  {
    control: "each item, img: …",
    does: "The endpoint's success rate as a meter, or a label when it had no deliveries.",
  },
  {
    control: "link: Open failed deliveries",
    does: "Opens Webhooks > Deliveries filtered to failed deliveries.",
    links: "[Deliveries](../../webhooks/deliveries.md).",
  },
  {
    control: "each item, link: …",
    does: "A recent failed delivery, with its endpoint, code and time; opens it.",
    operationIds: ["getWebhooksDeliveriesByDeliveryId"],
  },
  { control: "columnheader: Hour", does: "The hour (or day) of the row." },
  {
    control: "columnheader: Succeeded",
    does: "Deliveries answered 2xx.",
  },
  {
    control: "columnheader: Retrying",
    does: "Deliveries that failed and are waiting for a retry.",
  },
  {
    control: "columnheader: Failed",
    does: "Deliveries that failed every attempt.",
  },
  { control: "columnheader: Total", does: "All deliveries in the row." },
  {
    control: "columnheader: p# latency",
    does: "The 95th percentile answer time in the row.",
  },
  {
    control: "paragraph: No deliveries yet",
    does: "Shown when no webhook has been delivered yet.",
  },
  {
    control:
      "paragraph: Deliveries show up here once a rule fires or you send a test to an endpoint.",
    does: "Explains how deliveries start.",
  },
  {
    control: "link: Go to endpoints",
    does: "Opens Webhooks > Endpoints, to add one or send a test.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "alert: Could not load the webhook metrics. Try again",
    does: "Shown when the metrics could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the webhook metrics.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the metrics again.",
    operationIds: ["getWebhooksMetrics"],
  },
];

/** Webhooks > Overview: delivery volume, success, latency and failures per endpoint. */
export const webhooksOverviewPage: DeeperPage = {
  screen: "/webhooks/overview",
  file: "webhooks/overview.md",
  title: "Webhooks overview in depth",
  description: "Every control and text of Webhooks > Overview.",
  guidePage: "webhooks/index.md",
  guideTitle: "Webhooks",
  intro:
    "Webhooks > Overview shows how your endpoints are doing, computed from the delivery log each time you open it.",
  entries: overviewEntries,
};
