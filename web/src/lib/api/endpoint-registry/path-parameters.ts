/**
 * The description and example of every path parameter, by name
 * (docs/plan/21-reference-and-examples.md, WS-07.1). The OpenAPI build fails
 * on a path parameter that is not listed here.
 */

export type PathParameterDoc = {
  description: string;
  example: string | number;
};

/** A ULID, the ID format of everything SendMock stores. */
const exampleUlid = "01JB7T9Q2R5W8X3Y6Z1A4B7C9D";

export const pathParameterDocs: Record<string, PathParameterDoc> = {
  attachmentIndex: {
    description:
      "Position of the file in the email's `attachments`, starting at 0.",
    example: 0,
  },
  binId: {
    description: "The HTTP bin's ID, from `GET /api/v1/http/bins`.",
    example: exampleUlid,
  },
  binPath: {
    description:
      "The bin's name, then any path your app adds, e.g. `slack/services/T000/B000`.",
    example: "slack",
  },
  credentialName: {
    description: "The credential's name in the gateway, e.g. `secret_key`.",
    example: "secret_key",
  },
  deliveryId: {
    description:
      "The webhook delivery's ID, from `GET /api/v1/webhooks/deliveries`.",
    example: exampleUlid,
  },
  emailId: {
    description: "The email's ID, from `GET /api/v1/emails`.",
    example: exampleUlid,
  },
  endpointId: {
    description:
      "The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.",
    example: exampleUlid,
  },
  fileIndex: {
    description:
      "Position of the uploaded file in the request's `files`, starting at 0.",
    example: 0,
  },
  flowKey: {
    description: "The payment flow's key, e.g. `card` or `wallet`.",
    example: "card",
  },
  gatewayKey: {
    description: "The payment gateway's key, e.g. `stripe` or `sslcommerz`.",
    example: "stripe",
  },
  kind: {
    description: "What to create: `email`, `sms`, `verification` or `http`.",
    example: "email",
  },
  mediaIndex: {
    description:
      "Position of the media file in the SMS's `media`, starting at 0.",
    example: 0,
  },
  methodKey: {
    description: "The payment method's key, e.g. `bkash` or `card`.",
    example: "bkash",
  },
  numberId: {
    description: "The virtual number's ID, from `GET /api/v1/numbers`.",
    example: exampleUlid,
  },
  paymentId: {
    description: "The payment's ID, from `GET /api/v1/payments`.",
    example: exampleUlid,
  },
  requestId: {
    description:
      "The captured request's ID, from `GET /api/v1/http/requests` or `GET /api/v1/logs/http`.",
    example: exampleUlid,
  },
  revision: {
    description: "The template revision number, from its history.",
    example: 1,
  },
  routeId: {
    description: "The inbound route's ID, from `GET /api/v1/inbound-routes`.",
    example: exampleUlid,
  },
  ruleId: {
    description: "The rule's ID, from the list of rules of the same kind.",
    example: exampleUlid,
  },
  savedId: {
    description: "The saved delivery's ID, from `GET /api/v1/webhooks/saved`.",
    example: exampleUlid,
  },
  serviceSid: {
    description:
      "The service SID: `MG...` for a Messaging Service, `VA...` for a Verify service.",
    example: "MG00000000000000000000000000000001",
  },
  sessionId: {
    description: "The SMTP session's ID, from `GET /api/v1/logs/smtp`.",
    example: exampleUlid,
  },
  smsId: {
    description: "The SMS's ID, from `GET /api/v1/sms`.",
    example: exampleUlid,
  },
  stack: {
    description:
      "Your app's stack: a language (`laravel`, `node`, `python`, `go`, `java`, `ruby`, `dotnet`, `curl`) or a framework (`php`, `express`, `nestjs`, `django`, `flask`, `fastapi`, `spring`, `rails`, `aspnet`).",
    example: "laravel",
  },
  stepIndex: {
    description: "Position of the step in the flow, starting at 0.",
    example: 0,
  },
  templateId: {
    description:
      "The webhook template's ID, e.g. `slack.incoming_webhook` or `custom.ops_alert`.",
    example: "slack.incoming_webhook",
  },
  variableId: {
    description:
      "The webhook variable's ID, from `GET /api/v1/webhooks/variables`.",
    example: exampleUlid,
  },
  verificationSid: {
    description: "The verification's SID, from `GET /api/v1/verify`.",
    example: "VE00000000000000000000000000000001",
  },
};
