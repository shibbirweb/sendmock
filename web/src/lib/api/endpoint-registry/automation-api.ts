import {
  type ApiEndpoint,
  fileOf,
  listOf,
  type QueryParameter,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

/** `since` and `timeout`, shared by every wait (docs/plan/06-api.md). */
const waitQueryParameters: QueryParameter[] = [
  {
    name: "since",
    description: "Only match items newer than this time (default: 30 s ago).",
    schema: "string",
  },
  {
    name: "timeout",
    description: "How long to wait, e.g. 10s (default 10s, at most 60s).",
    schema: "string",
  },
];

function stringQuery(name: string, description: string): QueryParameter {
  return { name, description, schema: "string" };
}

const waitEndpoints = tagEndpoints("Test helpers", [
  {
    method: "GET",
    path: "/api/v1/wait/email",
    summary: "Wait until a matching email arrives; 408 on timeout.",
    queryParameters: [
      stringQuery("to", "A recipient contains."),
      stringQuery("subject", "Subject contains."),
      ...waitQueryParameters,
    ],
    response: typeRef("EmailDetail"),
    errorStatuses: [408],
  },
  {
    method: "GET",
    path: "/api/v1/wait/sms",
    summary: "Wait until a matching SMS arrives; 408 on timeout.",
    queryParameters: [
      stringQuery("to", "The recipient number."),
      stringQuery("from", "The sender number."),
      ...waitQueryParameters,
    ],
    response: typeRef("SmsMessageDetail"),
    errorStatuses: [408],
  },
  {
    method: "GET",
    path: "/api/v1/wait/http",
    summary:
      "Wait until the catcher records a matching request; 408 on timeout.",
    queryParameters: [
      stringQuery("bin", "The bin name."),
      stringQuery("method", "The HTTP method."),
      ...waitQueryParameters,
    ],
    response: typeRef("CapturedHttpRequest"),
    errorStatuses: [408],
  },
  {
    method: "GET",
    path: "/api/v1/wait/webhook",
    summary: "Wait until a matching delivery finishes; 408 on timeout.",
    queryParameters: [
      stringQuery("endpoint", "The endpoint id or name."),
      stringQuery("event", "The event type, e.g. email.received."),
      stringQuery("status", "succeeded or failed."),
      ...waitQueryParameters,
    ],
    response: typeRef("WebhookDeliveryDetail"),
    errorStatuses: [408],
  },
  {
    method: "GET",
    path: "/api/v1/wait/payment",
    summary: "Wait until a payment reaches a status; 408 on timeout.",
    queryParameters: [
      stringQuery("provider", "The gateway key, e.g. stripe."),
      stringQuery("status", "The status to wait for, e.g. succeeded."),
      ...waitQueryParameters,
    ],
    response: typeRef("PaymentDetail"),
    errorStatuses: [408],
  },
  {
    method: "GET",
    path: "/api/v1/otp",
    summary: "The latest one-time code sent to a recipient.",
    queryParameters: [
      {
        ...stringQuery("to", "Email address or phone number."),
        isRequired: true,
      },
      stringQuery("channel", "email, sms or verify (default: any)."),
    ],
    response: typeRef("OtpLookup"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/links",
    summary: "The links of the latest email to a recipient.",
    queryParameters: [
      { ...stringQuery("to", "The recipient address."), isRequired: true },
    ],
    response: typeRef("LinksLookup"),
    errorStatuses: [404],
  },
]);

const automationEndpoints = tagEndpoints("Automation", [
  {
    method: "GET",
    path: "/api/v1/events/recent",
    summary:
      "The latest events, newest first: the polling twin of the live stream.",
    queryParameters: [
      stringQuery("since", "Only events newer than this time."),
      stringQuery("type", "An event type, e.g. http.captured."),
      {
        name: "limit",
        description: "At most this many (default 50).",
        schema: "integer",
      },
    ],
    response: listOf("AppEvent"),
  },
  {
    method: "GET",
    path: "/api/v1/integrations/{stack}",
    summary:
      "Copy-ready settings for a stack, as Settings > Connection shows them.",
    queryParameters: [
      stringQuery("channel", "email, sms or http (default email)."),
      stringQuery("host", "Where the app runs: local, docker-host or compose."),
    ],
    response: typeRef("IntegrationSnippet"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/scenarios/validate",
    summary: "Check a scenario file without running it.",
    requestBody: typeRef("ScenarioRequest"),
    response: typeRef("ScenarioValidation"),
  },
  {
    method: "POST",
    path: "/api/v1/scenarios/run",
    summary: "Run a scenario file step by step and report each step.",
    requestBody: typeRef("ScenarioRequest"),
    response: typeRef("ScenarioReport"),
    errorStatuses: [422],
  },
  {
    method: "GET",
    path: "/api/v1/ai/agents",
    summary:
      "For each AI agent, the install command and its MCP configuration.",
    response: listOf("AiAgentSetup"),
  },
  {
    method: "GET",
    path: "/api/v1/ai/skill",
    summary: "The SendMock agent skill as Markdown.",
    response: fileOf("text/markdown"),
  },
]);

export const automationApi: ApiEndpoint[] = [
  ...waitEndpoints,
  ...automationEndpoints,
];
