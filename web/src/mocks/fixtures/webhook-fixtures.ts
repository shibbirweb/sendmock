import type {
  AppEventType,
  DeliveryStatus,
  DeliveryTrigger,
  RetryPolicy,
  WebhookDelivery,
  WebhookRule,
} from "@/lib/api/types";
import {
  createMockUlid,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";
import {
  generateEndpointSecret,
  type WebhookEndpointRecord,
} from "@/mocks/webhooks/webhook-endpoint-record";

const defaultRetryPolicy: RetryPolicy = {
  max_attempts: 5,
  backoff_seconds: [1, 5, 30, 120, 600],
  retry_on_client_errors: false,
};

type EndpointSpec = Pick<
  WebhookEndpointRecord,
  "name" | "url" | "template_id"
> & {
  isEnabled?: boolean;
  createdBy?: WebhookEndpointRecord["created_by"];
};

const endpointSpecs: EndpointSpec[] = [
  {
    name: "Laravel inbound mail",
    url: "http://localhost:8000/webhooks/inbound-mail",
    template_id: "postmark.inbound",
  },
  {
    name: "SMS status callbacks",
    url: "http://localhost:3000/sms/status",
    template_id: "twilio.status_callback",
  },
  {
    name: "Team Slack alerts",
    url: "http://127.0.0.1:8025/catch/slack",
    template_id: "slack.incoming_webhook",
    createdBy: "mcp",
  },
  {
    name: "Everything as native JSON",
    url: "http://localhost:9000/sendmock-events",
    template_id: "native",
    isEnabled: false,
  },
];

export function buildWebhookEndpointFixtures(): WebhookEndpointRecord[] {
  return endpointSpecs.map((endpointSpec, endpointIndex) => ({
    id: createMockUlid(minutesAgoInMs(600 - endpointIndex)),
    name: endpointSpec.name,
    url: endpointSpec.url,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: endpointSpec.template_id,
    template_mode: "linked",
    secret: generateEndpointSecret(),
    previous_secret: null,
    previous_secret_expires_at: null,
    timeout_ms: 10_000,
    retry_policy: defaultRetryPolicy,
    is_enabled: endpointSpec.isEnabled ?? true,
    created_by: endpointSpec.createdBy ?? "ui",
    created_at: minutesAgo(600 - endpointIndex),
  }));
}

export function buildWebhookRuleFixtures(
  webhookEndpoints: WebhookEndpointRecord[],
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
  /** Specs with the same key are attempts of one event and share its id. */
  eventKey?: string;
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
    eventKey: "retried-status",
  },
  {
    minutesAgo: 5.02,
    endpointIndex: 1,
    eventType: "sms.status",
    status: "failed",
    statusCode: 500,
    attempt: 1,
    errorMessage: "Internal Server Error",
    eventKey: "retried-status",
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

/**
 * Older traffic, two to 23 hours ago, so success sparklines and the
 * activity chart show a day of history. Deterministic: the same hours
 * fail on every load.
 */
function buildHistoryDeliverySpecs(): DeliverySpec[] {
  const historySpecs: DeliverySpec[] = [];
  for (let hoursAgo = 2; hoursAgo <= 23; hoursAgo += 1) {
    const hasInboundMailFailure = hoursAgo === 13;
    historySpecs.push({
      minutesAgo: hoursAgo * 60,
      endpointIndex: 0,
      eventType: "email.received",
      status: hasInboundMailFailure ? "failed" : "succeeded",
      statusCode: hasInboundMailFailure ? 502 : 200,
    });
    const hasStatusCallbackFailure = hoursAgo % 5 === 0;
    historySpecs.push({
      minutesAgo: hoursAgo * 60 + 7,
      endpointIndex: 1,
      eventType: "sms.status",
      status: hasStatusCallbackFailure ? "failed" : "succeeded",
      statusCode: hasStatusCallbackFailure ? 503 : 200,
    });
    if (hoursAgo % 3 === 0) {
      historySpecs.push({
        minutesAgo: hoursAgo * 60 + 19,
        endpointIndex: 2,
        eventType: "email.received",
        status: "succeeded",
        statusCode: 200,
      });
    }
  }

  return historySpecs;
}

export function buildWebhookDeliveryFixtures(
  webhookEndpoints: WebhookEndpointRecord[],
): WebhookDelivery[] {
  const eventIdsByKey = new Map<string, string>();
  const readEventId = (deliverySpec: DeliverySpec) => {
    const generatedEventId = `evt_${createMockUlid(minutesAgoInMs(deliverySpec.minutesAgo))}`;
    if (deliverySpec.eventKey === undefined) {
      return generatedEventId;
    }
    if (!eventIdsByKey.has(deliverySpec.eventKey)) {
      eventIdsByKey.set(deliverySpec.eventKey, generatedEventId);
    }

    return eventIdsByKey.get(deliverySpec.eventKey) ?? generatedEventId;
  };

  const allDeliverySpecs = [...deliverySpecs, ...buildHistoryDeliverySpecs()];
  const hasLaterAttempt = (deliverySpec: DeliverySpec) =>
    deliverySpec.eventKey !== undefined &&
    allDeliverySpecs.some(
      (otherSpec) =>
        otherSpec.eventKey === deliverySpec.eventKey &&
        (otherSpec.attempt ?? 1) > (deliverySpec.attempt ?? 1),
    );

  return allDeliverySpecs.map((deliverySpec) => {
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
      event_id: readEventId(deliverySpec),
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
        ? 40 + Math.round((deliverySpec.minutesAgo * 13) % 400)
        : null,
      error_message: deliverySpec.errorMessage ?? null,
      // Only the latest attempt of an event can still have one scheduled.
      next_attempt_at:
        deliverySpec.status === "failed" && !hasLaterAttempt(deliverySpec)
          ? minutesAgo(-1)
          : null,
      created_at: minutesAgo(deliverySpec.minutesAgo),
    };
  });
}

/**
 * Points each email and SMS delivery at a stored message, so the detail can
 * link to what caused it. Other events keep no subject.
 */
export function linkDeliverySubjects(
  webhookDeliveries: WebhookDelivery[],
  emailIds: string[],
  smsIds: string[],
): WebhookDelivery[] {
  return webhookDeliveries.map((webhookDelivery, deliveryIndex) => {
    const subjectIds = webhookDelivery.event_type.startsWith("email.")
      ? emailIds
      : webhookDelivery.event_type.startsWith("sms.")
        ? smsIds
        : [];

    return {
      ...webhookDelivery,
      subject_id:
        subjectIds[deliveryIndex % Math.max(1, subjectIds.length)] ?? null,
    };
  });
}
