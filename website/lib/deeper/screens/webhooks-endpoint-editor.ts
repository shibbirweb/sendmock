import type { DeeperEntry } from "../deeper-types";

/** The endpoint editor: General, Request, Security, Retries and Variables. */
export const endpointEditorEntries: DeeperEntry[] = [
  { control: "heading: Add an endpoint", does: "The new endpoint editor." },
  {
    control: "heading: Laravel inbound mail",
    does: "The endpoint open in the editor (here the demo's Laravel endpoint).",
  },
  {
    control:
      "paragraph: Where SendMock sends webhooks, in which format, and how it retries.",
    does: "Explains the editor.",
  },
  {
    control: "tab: General",
    does: "Name, method, URL, timeout and whether it is on.",
  },
  {
    control: "tab: Request",
    does: "Query parameters, headers and the body: a template, fields, raw text or none.",
  },
  {
    control: "tab: Security",
    does: "The signing secret and its rotation; open once the endpoint is added.",
  },
  {
    control: "tab: Retries",
    does: "How many attempts, how far apart, and what retries.",
  },
  {
    control: "tab: Variables",
    does: "Variables only this endpoint reads; open once the endpoint is added.",
  },
  {
    control:
      "paragraph: The signing secret and variables can be set once the endpoint is added.",
    does: "Explains why Security and Variables wait.",
  },
  {
    control: "textbox: Name",
    does: "The endpoint's name in lists, rules and deliveries.",
  },
  {
    control: "combobox: Method",
    does: "The HTTP method of its requests, POST by default.",
  },
  {
    control: "textbox: URL",
    does: "Where requests go; it may hold `{{ }}` templates, rendered for each delivery.",
    errors: "A URL that is not http or https is refused.",
  },
  {
    control: "textbox: Timeout (seconds)",
    does: "How long SendMock waits for an answer.",
  },
  {
    control:
      "paragraph: # to # seconds. A slower answer counts as a timeout and is retried.",
    does: "The allowed range and what a timeout does.",
  },
  {
    control:
      "paragraph: A disabled endpoint keeps its rules but receives nothing.",
    does: "Explains Enabled.",
  },
  {
    control: "switch: Enabled",
    does: "Whether the endpoint receives deliveries.",
  },
  { control: "button: Cancel", does: "Closes the editor without saving." },
  {
    control: "button: Add endpoint",
    state: "New endpoint editor",
    does: "Adds the endpoint and opens its other tabs.",
    operationIds: ["postWebhooksEndpoints"],
  },
  {
    control: "button: Send test",
    does: "Sends a signed `test.ping` to the endpoint as last saved, and shows what it answered.",
    operationIds: ["postWebhooksEndpointsByEndpointIdTest"],
  },
  {
    control: "button: Save changes",
    does: "Saves the endpoint; the next delivery uses it.",
    operationIds: ["patchWebhooksEndpointsByEndpointId"],
  },
  {
    control: "paragraph: None. Added to the URL, URL-encoded.",
    does: "The query parameters; none yet.",
  },
  {
    control: "button: Add query param",
    does: "Adds a query parameter, whose value may be a template.",
  },
  {
    control: "paragraph: None besides Content-Type and the signature headers.",
    does: "The extra headers; none yet.",
  },
  {
    control: "button: Add header",
    does: "Adds a header, whose value may be a template.",
  },
  {
    control: "radio: Template",
    does: "The body comes from a webhook template.",
  },
  {
    control: "radio: Fields",
    does: "The body is built from name and value fields, as JSON, a form or multipart.",
  },
  {
    control: "radio: Raw",
    does: "The body is text you write, with templates inside.",
  },
  { control: "radio: None", does: "No body." },
  {
    control: "combobox: Template",
    does: "The template the body comes from, such as native JSON or a provider's format.",
    links: "[Templates](../../webhooks/templates.md).",
  },
  {
    control:
      "paragraph: Postmark: inbound payload, matching the provider's documented format.",
    does: "Describes the chosen template (here Postmark's inbound format).",
  },
  {
    control:
      "paragraph: Based on Postmark: inbound rev #. Built-in templates are always linked: edit them on the Templates screen, or clone one for a separate copy.",
    does: "Names the template revision the endpoint uses and how built-ins stay linked.",
  },
  {
    control: "radio: Linked Follows template updates; overrides go on top.",
    does: "The endpoint follows the template as it changes, with its own field overrides on top.",
  },
  {
    control: "radio: Detached A private copy that never changes on its own.",
    does: "The endpoint keeps its own copy of the template.",
  },
  {
    control:
      "paragraph: None. Added to what the template sends; values accept {{ }} templates.",
    does: "The extra body fields; none yet.",
  },
  {
    control: "button: Add field",
    does: "Adds a body field on top of the template.",
  },
  {
    control:
      "paragraph: Keep this endpoint's template and overrides, as last saved, as a template of your own.",
    does: "Explains Save as template.",
  },
  {
    control: "button: Save as template",
    does: "Saves the endpoint's request as a new custom template.",
    operationIds: ["postWebhooksEndpointsByEndpointIdSaveAsTemplate"],
  },
  {
    control:
      "radio: Strict An undefined value stops the delivery as render failed.",
    does: "A template value that is not defined stops the delivery with `render_failed`.",
  },
  {
    control: "radio: Lenient An undefined value renders empty, with a warning.",
    does: "A value that is not defined renders empty and the delivery goes on.",
  },
  {
    control: "combobox: Preview with",
    does: "The event the preview renders with: a sample, or a recent real message.",
    operationIds: ["postWebhooksEndpointsPreview"],
  },
  {
    control: "button: Copy rendered URL",
    does: "Copies the URL as rendered for the preview event.",
  },
  {
    control: "heading: Rendered headers",
    does: "The headers a delivery would carry, signature included.",
  },
  {
    control: "heading: Rendered body",
    does: "The body a delivery would carry.",
  },
  { control: "button: Copy rendered body", does: "Copies the rendered body." },
  {
    control: "button: Reveal",
    does: "Shows the signing secret (`whsec_...`) once, after you confirm.",
    operationIds: ["getWebhooksEndpointsByEndpointIdSecret"],
  },
  {
    control: "combobox: Overlap after rotating",
    does: "How long the previous secret keeps signing beside the new one after a rotation.",
  },
  {
    control:
      "paragraph: Both secrets sign during the overlap, so you can test a rolling update.",
    does: "Explains the overlap: each request carries both signatures.",
  },
  {
    control: "button: Rotate secret",
    does: "Makes a new signing secret.",
    links: "[Endpoints](../../webhooks/endpoints.md).",
    operationIds: ["postWebhooksEndpointsByEndpointIdRotateSecret"],
  },
  {
    control: "textbox: Max attempts",
    does: "How many tries in all, counting the first.",
  },
  {
    control: "paragraph: # to #, counting the first try.",
    does: "The allowed range.",
  },
  {
    control:
      "paragraph: # second to # hours, used in order; the last one repeats.",
    does: "Explains the retry delays.",
  },
  {
    control: "each item, button: Remove retry delay #",
    does: "Removes that delay.",
  },
  {
    control: "textbox: Delay before each retry",
    does: "A delay to add, such as `30s` or `5m`.",
  },
  { control: "button: Add delay", does: "Adds the delay to the schedule." },
  {
    control:
      "paragraph: #xx answers, timeouts and connection errors always retry.",
    does: "What always retries.",
  },
  {
    control: "switch: Retry on #xx",
    does: "Also retries 4xx answers, which by default end the delivery at once.",
  },
  {
    control: "paragraph: Attempts at # s, # s, # s, # s, # m # s.",
    does: "When each attempt would happen, from the settings above.",
  },
  {
    control: "heading: Endpoint variables",
    does: "Variables only this endpoint reads.",
  },
  {
    control: "button: Add variable",
    does: "Adds a text or secret variable for this endpoint.",
    operationIds: ["postWebhooksVariables"],
  },
  {
    control:
      "paragraph: Used as {{ vars.name }} by this endpoint only; they win over global variables of the same name. Number, JSON, Dynamic, Random and the other kinds are on the Variables screen .",
    does: "Explains endpoint variables.",
  },
  {
    control: "link: Variables screen",
    does: "Opens Webhooks > Variables.",
    links: "[Variables](../../webhooks/variables.md).",
  },
  {
    control: "paragraph: No endpoint variables.",
    does: "Shown while it has none.",
  },
];
