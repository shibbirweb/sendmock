import type { DeeperEntry, DeeperPage } from "../deeper-types";

const composerEntries: DeeperEntry[] = [
  {
    control: "heading: Composer",
    does: "Names the screen, in the header and above the form.",
  },
  {
    control: "link: Read the Composer guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links:
      "[Composer and saved deliveries](../../webhooks/composer-and-saved.md).",
  },
  {
    control:
      "paragraph: Write a webhook request by hand, start from any template, and send it to an endpoint.",
    does: "Explains the screen.",
  },
  {
    control: "combobox: Send to",
    does: "The endpoint the request goes to.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
  },
  {
    control: "paragraph: Its secret signs the request.",
    does: "Explains that the endpoint's secret signs it.",
  },
  {
    control: "combobox: Preset",
    does: "A template to start from: it fills the method, headers and body, which you can then change.",
  },
  {
    control:
      "paragraph: A template fills the method, headers and body, ready to edit.",
    does: "Explains Preset.",
  },
  { control: "combobox: Method", does: "The HTTP method." },
  {
    control: "textbox: URL",
    does: "A URL for this request only; it may hold `{{ }}` templates.",
  },
  {
    control: "paragraph: Leave empty to use the endpoint's URL.",
    does: "Explains the URL field.",
  },
  {
    control: "paragraph: None. Added to the URL, URL-encoded.",
    does: "The query parameters; none yet.",
  },
  { control: "button: Add query param", does: "Adds a query parameter." },
  {
    control: "paragraph: None besides Content-Type and the signature headers.",
    does: "The extra headers; none yet.",
  },
  { control: "button: Add header", does: "Adds a header." },
  {
    control: "radio: Template",
    does: "The body comes from a webhook template.",
  },
  {
    control: "radio: Fields",
    does: "The body is built from name and value fields.",
  },
  {
    control: "radio: Raw",
    does: "The body is text you write, with templates inside.",
  },
  { control: "radio: None", does: "No body." },
  { control: "combobox: Content type", does: "The raw body's `Content-Type`." },
  {
    control: "button: Insert",
    does: "Inserts a value, function or filter at the cursor, from the template reference.",
  },
  { control: "textbox: Raw body", does: "The body, in the template language." },
  {
    control:
      "paragraph: Type {{ to see what you can use; hover a value to see an example.",
    does: "Explains the template suggestions.",
    links: "[Template filters](../../reference/template-filters.md).",
  },
  {
    control:
      "radio: Strict An undefined value stops the delivery as render failed.",
    does: "A value that is not defined stops the send.",
  },
  {
    control: "radio: Lenient An undefined value renders empty, with a warning.",
    does: "A value that is not defined renders empty.",
  },
  {
    control: "textbox: vars.reason",
    does: "A variable the template asks for on manual sends (here `reason`).",
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
    control: "combobox: Preview with",
    does: "The event the preview renders with: a sample, or a recent real message.",
    operationIds: ["postWebhooksEndpointsPreview"],
  },
  { control: "button: Copy rendered URL", does: "Copies the URL as rendered." },
  {
    control: "heading: Rendered headers",
    does: "The headers the request will carry, signature included.",
  },
  {
    control: "heading: Rendered body",
    does: "The body the request will carry.",
  },
  { control: "button: Copy rendered body", does: "Copies the rendered body." },
  {
    control: "button: Send",
    does: "Sends the request now and shows the delivery it made, which you can then save.",
    changes: "Records a manual delivery in Webhooks > Deliveries.",
    errors: "A template that does not render is refused with the reason.",
    operationIds: ["postWebhooksEndpointsByEndpointIdSend"],
  },
  {
    control: "alert: Could not load the endpoints to send to. Try again",
    does: "Shown when the endpoints could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the endpoints to send to.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the endpoints again.",
    operationIds: ["getWebhooksEndpoints"],
  },
];

const savedEntries: DeeperEntry[] = [
  { control: "heading: Saved", does: "Names the open screen in the header." },
  {
    control: "link: Read the Saved guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links:
      "[Composer and saved deliveries](../../webhooks/composer-and-saved.md).",
  },
  {
    control: "heading: Saved deliveries",
    does: "Requests you bookmarked, from a delivery or the composer.",
    operationIds: ["getWebhooksSaved"],
  },
  {
    control:
      "paragraph: Requests you bookmarked, kept through pruning and reset, ready to send again.",
    does: "Explains the screen.",
  },
  {
    control: "textbox: Search saved deliveries",
    does: "Filters by name, URL or template.",
  },
  {
    control:
      "button: Twilio STOP reply POST http://localhost:#/sms/inbound From the composer · Twilio: inbound SMS · saved # hours ago",
    does: "A saved delivery (here the demo's Twilio STOP reply): its name, method, URL, where it came from, its template and when it was saved. Shows or hides its stored request.",
  },
  {
    control: "button: Send Twilio STOP reply",
    does: "Opens the Send dialog for it.",
  },
  {
    control: "button: Rename Twilio STOP reply",
    does: "Renames it.",
    operationIds: ["patchWebhooksSavedBySavedId"],
  },
  {
    control: "button: Save as template Twilio STOP reply",
    does: "Turns it into a custom template.",
    links: "[Templates](../../webhooks/templates.md).",
    operationIds: ["postWebhooksSavedBySavedIdTemplate"],
  },
  {
    control: "button: Delete Twilio STOP reply",
    does: "Deletes it after you confirm.",
    operationIds: ["deleteWebhooksSavedBySavedId"],
  },
  {
    control: 'heading: Send "Twilio STOP reply"',
    does: "The Send dialog of a saved delivery.",
  },
  {
    control:
      "paragraph: The stored body goes to the endpoint's URL with its method.",
    does: "Explains what is sent.",
  },
  {
    control: "combobox: Endpoint",
    does: "The endpoint to send it to; any endpoint works.",
  },
  {
    control: "checkbox: Re-render with fresh values",
    does: "Renders the template again instead of sending the stored body as it was.",
  },
  {
    control:
      "paragraph: New timestamp, signature and random values, as a fresh event would get.",
    does: "Explains what re-rendering changes.",
  },
  { control: "button: Cancel", does: "Closes the dialog without sending." },
  {
    control: "button: Send",
    does: "Sends it now as a new delivery.",
    operationIds: ["postWebhooksSavedBySavedIdSend"],
  },
  { control: "button: Close", does: "Closes the dialog without sending." },
  {
    control: "alert: Could not load the saved deliveries. Try again",
    does: "Shown when the saved deliveries could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the saved deliveries.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getWebhooksSaved"],
  },
];

/** Webhooks > Composer: a webhook request written by hand. */
export const webhooksComposerPage: DeeperPage = {
  screen: "/webhooks/composer",
  file: "webhooks/composer.md",
  title: "Composer in depth",
  description: "Every control and text of Webhooks > Composer.",
  guidePage: "webhooks/composer-and-saved.md",
  guideTitle: "Composer and saved deliveries",
  intro:
    "Webhooks > Composer writes a webhook request by hand, or from any template, and sends it to an endpoint.",
  entries: composerEntries,
};

/** Webhooks > Saved: bookmarked requests to send again. */
export const webhooksSavedPage: DeeperPage = {
  screen: "/webhooks/saved",
  file: "webhooks/saved.md",
  title: "Saved deliveries in depth",
  description:
    "Every control and text of Webhooks > Saved and its Send dialog.",
  guidePage: "webhooks/composer-and-saved.md",
  guideTitle: "Composer and saved deliveries",
  intro:
    "Webhooks > Saved keeps the requests you bookmarked, through pruning and reset, to send to any endpoint again.",
  entries: savedEntries,
};
