import type {
  AppEventType,
  DeliveryStatus,
  DeliveryTrigger,
  RetryPolicy,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRule,
} from "@/lib/api/types";
import {
  createMockUlid,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

const defaultRetryPolicy: RetryPolicy = {
  max_attempts: 5,
  backoff_seconds: [1, 5, 30, 120, 600],
  retry_on_client_errors: false,
};

type EndpointSpec = Pick<WebhookEndpoint, "name" | "url" | "template_id"> & {
  successRate: number | null;
  isEnabled?: boolean;
  createdBy?: WebhookEndpoint["created_by"];
};

const endpointSpecs: EndpointSpec[] = [
  {
    name: "Laravel inbound mail",
    url: "http://localhost:8000/webhooks/inbound-mail",
    template_id: "postmark.inbound",
    successRate: 0.96,
  },
  {
    name: "SMS status callbacks",
    url: "http://localhost:3000/sms/status",
    template_id: "twilio.status_callback",
    successRate: 0.81,
  },
  {
    name: "Team Slack alerts",
    url: "http://127.0.0.1:8025/catch/slack",
    template_id: "slack.incoming_webhook",
    successRate: 1,
    createdBy: "mcp",
  },
  {
    name: "Everything as native JSON",
    url: "http://localhost:9000/mss-events",
    template_id: "native",
    successRate: null,
    isEnabled: false,
  },
];

export function buildWebhookEndpointFixtures(): WebhookEndpoint[] {
  return endpointSpecs.map((endpointSpec, endpointIndex) => ({
    id: createMockUlid(minutesAgoInMs(600 - endpointIndex)),
    name: endpointSpec.name,
    url: endpointSpec.url,
    method: "POST",
    headers: {},
    template_id: endpointSpec.template_id,
    template_mode: "linked",
    masked_secret: `whsec_••••${(4096 + endpointIndex * 977).toString(16)}`,
    timeout_ms: 10_000,
    retry_policy: defaultRetryPolicy,
    is_enabled: endpointSpec.isEnabled ?? true,
    success_rate: endpointSpec.successRate,
    created_by: endpointSpec.createdBy ?? "ui",
    created_at: minutesAgo(600 - endpointIndex),
  }));
}

export function buildWebhookRuleFixtures(
  webhookEndpoints: WebhookEndpoint[],
): WebhookRule[] {
  const [
    inboundMailEndpoint,
    smsStatusEndpoint,
    slackEndpoint,
    nativeEndpoint,
  ] = webhookEndpoints;

  return [
    {
      id: createMockUlid(),
      name: "Support inbox to Laravel",
      endpoint_id: inboundMailEndpoint?.id ?? "",
      events: ["email.received"],
      filter: { field: "to", operator: "matches", value: "*@inbound.local" },
      is_enabled: true,
      order: 1,
      created_by: "ui",
    },
    {
      id: createMockUlid(),
      name: "SMS delivery status",
      endpoint_id: smsStatusEndpoint?.id ?? "",
      events: ["sms.status"],
      filter: null,
      is_enabled: true,
      order: 2,
      created_by: "seed",
    },
    {
      id: createMockUlid(),
      name: "Bounces and complaints to Slack",
      endpoint_id: slackEndpoint?.id ?? "",
      events: ["email.bounced", "email.complained"],
      filter: {
        any: [
          { field: "to", operator: "matches", value: "*@example.com" },
          { field: "tag", operator: "equals", value: "billing" },
        ],
      },
      is_enabled: true,
      order: 3,
      created_by: "mcp",
    },
    {
      id: createMockUlid(),
      name: "Mirror everything",
      endpoint_id: nativeEndpoint?.id ?? "",
      events: ["email.received", "sms.sent", "sms.inbound"],
      filter: null,
      is_enabled: false,
      order: 4,
      created_by: "ui",
    },
  ];
}

type DeliverySpec = {
  minutesAgo: number;
  endpointIndex: number;
  eventType: AppEventType;
  status: DeliveryStatus;
  statusCode: number | null;
  attempt?: number;
  trigger?: DeliveryTrigger;
  errorMessage?: string;
};

const deliverySpecs: DeliverySpec[] = [
  {
    minutesAgo: 0.6,
    endpointIndex: 1,
    eventType: "sms.status",
    status: "succeeded",
    statusCode: 200,
  },
  {
    minutesAgo: 1.1,
    endpointIndex: 0,
    eventType: "email.received",
    status: "succeeded",
    statusCode: 202,
  },
  {
    minutesAgo: 5,
    endpointIndex: 1,
    eventType: "sms.status",
    status: "failed",
    statusCode: 500,
    attempt: 2,
    errorMessage: "Internal Server Error",
  },
  {
    minutesAgo: 12,
    endpointIndex: 1,
    eventType: "sms.status",
    status: "exhausted",
    statusCode: null,
    attempt: 5,
    errorMessage: "Connection refused (localhost:3000)",
  },
  {
    minutesAgo: 16,
    endpointIndex: 2,
    eventType: "email.bounced",
    status: "succeeded",
    statusCode: 200,
  },
  {
    minutesAgo: 21,
    endpointIndex: 0,
    eventType: "email.received",
    status: "render_failed",
    statusCode: null,
    errorMessage: "Undefined variable: vars.tenant_id (line 4, column 13)",
  },
  {
    minutesAgo: 27,
    endpointIndex: 0,
    eventType: "email.received",
    status: "succeeded",
    statusCode: 200,
    trigger: "replay",
  },
  {
    minutesAgo: 33,
    endpointIndex: 2,
    eventType: "test.ping",
    status: "succeeded",
    statusCode: 200,
    trigger: "manual",
  },
  {
    minutesAgo: 44,
    endpointIndex: 1,
    eventType: "sms.status",
    status: "failed",
    statusCode: null,
    attempt: 1,
    errorMessage: "Timed out after 10000 ms",
  },
];

export function buildWebhookDeliveryFixtures(
  webhookEndpoints: WebhookEndpoint[],
): WebhookDelivery[] {
  return deliverySpecs.map((deliverySpec) => {
    const webhookEndpoint = webhookEndpoints[deliverySpec.endpointIndex];
    const requestBody = JSON.stringify(
      { type: deliverySpec.eventType, data: {} },
      null,
      2,
    );
    const wasSent = deliverySpec.status !== "render_failed";

    return {
      id: createMockUlid(minutesAgoInMs(deliverySpec.minutesAgo)),
      endpoint_id: webhookEndpoint?.id ?? "",
      endpoint_name: webhookEndpoint?.name ?? "",
      rule_id: null,
      event_id: `evt_${createMockUlid(minutesAgoInMs(deliverySpec.minutesAgo))}`,
      event_type: deliverySpec.eventType,
      subject_id: null,
      trigger: deliverySpec.trigger ?? "auto",
      attempt: deliverySpec.attempt ?? 1,
      status: deliverySpec.status,
      request: wasSent
        ? {
            method: "POST",
            url: webhookEndpoint?.url ?? "",
            headers: {
              "content-type": "application/json",
              "webhook-id": "evt_01JB...",
              "webhook-timestamp": "1761321600",
              "webhook-signature":
                "v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=",
            },
            body: requestBody,
          }
        : null,
      response:
        deliverySpec.statusCode === null
          ? null
          : {
              status_code: deliverySpec.statusCode,
              headers: { "content-type": "application/json" },
              body:
                deliverySpec.statusCode < 300
                  ? '{"ok":true}'
                  : '{"error":"boom"}',
              is_body_truncated: false,
            },
      duration_ms: wasSent
        ? 40 + Math.round(deliverySpec.minutesAgo * 13)
        : null,
      error_message: deliverySpec.errorMessage ?? null,
      next_attempt_at: deliverySpec.status === "failed" ? minutesAgo(-1) : null,
      created_at: minutesAgo(deliverySpec.minutesAgo),
    };
  });
}
