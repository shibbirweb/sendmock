import type { DeeperEntry, DeeperPage } from "../deeper-types";

const overviewEntries: DeeperEntry[] = [
  { control: "heading: Overview", does: "Names the screen, in the header and above the dashboard." },
  {
    control: "link: Read the Overview guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Overview](../overview.md).",
  },
  { control: "paragraph: Everything your apps sent to SendMock, updated live.", does: "Explains the dashboard.", operationIds: ["getStats"] },
  {
    control: "each item, link: …",
    does: "A tile with today's count for emails, SMS, webhook deliveries, HTTP requests or payments, and its trend; opens that screen.",
    source: "`GET /api/v1/stats`, computed from the stored traffic each time.",
  },
  { control: "switch: Show as table", does: "Shows the activity chart as a table, to read exact numbers." },
  { control: "columnheader: Endpoint", does: "A webhook endpoint." },
  { control: "columnheader: Deliveries", does: "Its deliveries today." },
  { control: "columnheader: Success", does: "The share answered 2xx." },
  { control: "columnheader: p# / p#", does: "The median and 95th percentile answer times." },
  { control: "columnheader: Retries", does: "How many attempts were retries." },
  { control: "columnheader: Top failures", does: "The failure codes it got most." },
  { control: "each item, img: …", does: "An endpoint's success rate as a meter, or a label when it had no deliveries." },
  { control: "radio: This machine", does: "Shows the addresses for an app on the same machine.", changes: "Shared with Settings > Connection and remembered in the browser.", operationIds: ["getInfo"] },
  { control: "radio: Docker host", does: "Shows the addresses for an app in a container reaching SendMock on the host." },
  { control: "radio: Compose", does: "Shows the addresses for an app in the same Docker Compose project." },
  { control: "button: Copy SMTP address", does: "Copies the SMTP host and port." },
  { control: "button: Copy API base URL", does: "Copies the REST API's base URL." },
  { control: "link: More snippets", does: "Opens Settings > Connection.", links: "[Settings](../settings.md)." },
  { control: "paragraph: No failed deliveries. Every webhook got through.", does: "Shown in Recent failures when no delivery failed." },
  { control: "paragraph: Nothing yet. Send an email or SMS from your app, or try a sample.", does: "Shown when nothing has arrived yet." },
  { control: "button: Send a sample email", does: "Stores a sample email.", operationIds: ["postSamplesByKind"] },
  { control: "button: Send a sample SMS", does: "Stores a sample SMS.", operationIds: ["postSamplesByKind"] },
  {
    control: "alert: Could not load the overview. Check that SendMock is running. Try again",
    does: "Shown when the dashboard could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  { control: "paragraph: Could not load the overview. Check that SendMock is running.", does: "The message inside the alert." },
  { control: "button: Try again", does: "Loads the dashboard again.", operationIds: ["getStats"] },
];

const apiTagNames = [
  "System",
  "Seed",
  "Logs",
  "Test helpers",
  "Automation",
  "Email",
  "Inbound routes",
  "Tag rules",
  "Forward rules",
  "SMS",
  "Outcome rules",
  "Verify",
  "Numbers",
  "Email providers",
  "SMS providers",
  "HTTP Catcher",
  "Payments",
  "Checkout",
  "Payment flows",
  "Payment gateways",
  "Payment methods",
  "Webhook endpoints",
  "Webhook rules",
  "Webhook deliveries",
  "Saved deliveries",
  "Webhook templates",
  "Webhook variables",
  "Projects",
];

const apiReferenceEntries: DeeperEntry[] = [
  { control: "heading: API reference", does: "Names the screen, in the header and above the list." },
  {
    control: "paragraph: The REST API of this instance, read from its /api/openapi.json . Every screen, CLI command and MCP tool calls these endpoints.",
    does: "Explains the screen: it reads the running instance's own OpenAPI document.",
  },
  { control: "link: Download openapi.json", does: "Downloads the OpenAPI document." },
  { control: "searchbox: Search the API", does: "Filters operations by path, summary or operation id." },
  { control: "status: # of # operations", does: "How many operations match the search, of all." },
  ...apiTagNames.map((tagName): DeeperEntry => ({
    control: `heading: ${tagName}`,
    does: `The ${tagName} operations; each opens to show its parameters, body, answer and a curl command.`,
  })),
  {
    control: "alert: Could not load the API reference. Try again",
    does: "Shown when the OpenAPI document could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  { control: "paragraph: Could not load the API reference.", does: "The message inside the alert." },
  { control: "button: Try again", does: "Loads it again." },
];

/** The Overview dashboard. */
export const overviewPage: DeeperPage = {
  screen: "/",
  file: "overview.md",
  title: "Overview in depth",
  description: "Every control and text of the Overview dashboard.",
  guidePage: "overview.md",
  guideTitle: "Overview",
  intro: "The Overview shows today's traffic across email, SMS, webhooks, HTTP and payments, and how to connect.",
  entries: overviewEntries,
};

/** API reference, opened from the Help menu. */
export const apiReferencePage: DeeperPage = {
  screen: "/api-reference",
  file: "api-reference.md",
  title: "API reference in depth",
  description: "Every control and text of the in-app API reference.",
  guidePage: "reference/index.md",
  guideTitle: "Reference",
  intro: "The API reference, opened from Help, lists every REST operation the running SendMock serves.",
  entries: apiReferenceEntries,
};
