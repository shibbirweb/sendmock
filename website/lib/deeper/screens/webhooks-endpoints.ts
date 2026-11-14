import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { endpointEditorEntries } from "./webhooks-endpoint-editor";

const endpointListEntries: DeeperEntry[] = [
  {
    control: "heading: Endpoints",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Endpoints guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "heading: Webhook endpoints",
    does: "The list of URLs SendMock delivers webhooks to.",
    operationIds: ["getWebhooksEndpoints"],
  },
  {
    control:
      "paragraph: Where SendMock sends webhooks: URL, template, secret and retry policy.",
    does: "Explains the screen.",
  },
  {
    control: "button: Add endpoint",
    does: "Opens the new endpoint editor; in it, adds the endpoint.",
    operationIds: ["postWebhooksEndpoints"],
  },
  { control: "columnheader: Name", does: "The endpoint's name." },
  { control: "columnheader: URL", does: "Where its requests go." },
  {
    control: "columnheader: Template",
    does: "The format its requests are sent in.",
  },
  {
    control: "columnheader: # h",
    does: "Its deliveries over the last 24 hours, as a sparkline.",
  },
  {
    control: "columnheader: Success, # h",
    does: "The share of those deliveries answered 2xx.",
  },
  { control: "columnheader: On", does: "Whether it receives anything." },
  { control: "columnheader: Actions", does: "Send test, Edit and Delete." },
  {
    control: "each item, switch: … enabled",
    does: "Turns the endpoint on or off at once. While off, its rules stay but nothing is sent to it.",
    operationIds: ["patchWebhooksEndpointsByEndpointId"],
  },
  {
    control: "each item, button: Send test to …",
    does: "Sends a signed `test.ping` event to the endpoint now and shows what it answered.",
    operationIds: ["postWebhooksEndpointsByEndpointIdTest"],
  },
  {
    control: "each item, button: Edit …",
    does: "Opens the endpoint's editor.",
    operationIds: ["getWebhooksEndpointsByEndpointId"],
  },
  {
    control: "each item, button: Delete …",
    does: "Asks for confirmation, then deletes the endpoint.",
  },
  {
    control: "heading: Test sent to Laravel inbound mail",
    does: "The result of a test send (here to the demo's Laravel endpoint).",
  },
  {
    control: "paragraph: A test.ping event, signed like a real delivery.",
    does: "Explains what was sent.",
  },
  {
    control: "heading: Signed headers",
    does: "The headers sent, signature included, so you can check your verification code.",
  },
  {
    control: "heading: Response body",
    does: "What the endpoint answered, with its status and time.",
  },
  {
    control: "link: Open delivery",
    does: "Opens the test's delivery in Webhooks > Deliveries.",
    links: "[Deliveries](../../webhooks/deliveries.md).",
  },
  { control: "button: Done", does: "Closes the result." },
  { control: "button: Close", does: "Closes the dialog or editor." },
  {
    control: "heading: Delete Laravel inbound mail?",
    does: "The confirmation before deleting an endpoint.",
  },
  {
    control:
      "paragraph: Its # rule and its variables go with it. Past deliveries stay in the log.",
    does: "Says what is deleted with it and what stays.",
  },
  {
    control: "button: Keep it",
    does: "Closes the confirmation without deleting.",
  },
  {
    control: "button: Delete",
    does: "Deletes the endpoint, its rules and its variables.",
    operationIds: ["deleteWebhooksEndpointsByEndpointId"],
  },
  {
    control: "alert: Could not load the endpoints. Try again",
    does: "Shown when the endpoints could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the endpoints.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the endpoints again.",
    operationIds: ["getWebhooksEndpoints"],
  },
];

/** Webhooks > Endpoints: where webhooks go, and the endpoint editor. */
export const webhooksEndpointsPage: DeeperPage = {
  screen: "/webhooks/endpoints",
  file: "webhooks/endpoints.md",
  title: "Endpoints in depth",
  description:
    "Every control and text of Webhooks > Endpoints and the endpoint editor's tabs.",
  guidePage: "webhooks/endpoints.md",
  guideTitle: "Endpoints",
  intro:
    "Webhooks > Endpoints lists the URLs SendMock delivers webhooks to, each with its format, signing secret and retry policy.",
  entries: [...endpointListEntries, ...endpointEditorEntries],
};
