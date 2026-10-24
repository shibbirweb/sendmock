import type {
  AppEventType,
  SavedDelivery,
  TemplateCategory,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";
import { createMockUlid, minutesAgo } from "@/mocks/fixtures/fixture-helpers";

type TemplateSpec = [
  id: string,
  name: string,
  service: string,
  category: TemplateCategory,
  events: AppEventType[],
  requiredVariables: string[],
];

const emailOutcomeEvents: AppEventType[] = [
  "email.received",
  "email.opened",
  "email.delivered",
  "email.bounced",
  "email.complained",
];

/** The built-in catalogue from docs/plan/13-webhook-templates.md. */
const builtinTemplateSpecs: TemplateSpec[] = [
  [
    "native",
    "Native SendMock JSON",
    "SendMock",
    "generic",
    ["email.received", "sms.sent", "sms.inbound", "sms.status"],
    [],
  ],
  [
    "twilio.inbound_sms",
    "Twilio: inbound SMS",
    "Twilio",
    "sms-provider",
    ["sms.inbound"],
    ["twilio_auth_token"],
  ],
  [
    "twilio.status_callback",
    "Twilio: status callback",
    "Twilio",
    "sms-provider",
    ["sms.status", "sms.opened"],
    ["twilio_auth_token"],
  ],
  [
    "vonage.inbound",
    "Vonage: inbound SMS",
    "Vonage",
    "sms-provider",
    ["sms.inbound"],
    [],
  ],
  [
    "vonage.dlr",
    "Vonage: delivery receipt",
    "Vonage",
    "sms-provider",
    ["sms.status"],
    [],
  ],
  [
    "plivo.inbound",
    "Plivo: inbound message",
    "Plivo",
    "sms-provider",
    ["sms.inbound", "sms.status"],
    [],
  ],
  [
    "telnyx.message",
    "Telnyx: message events",
    "Telnyx",
    "sms-provider",
    ["sms.inbound", "sms.status"],
    [],
  ],
  [
    "mailgun.routes",
    "Mailgun: routes (inbound)",
    "Mailgun",
    "email-provider",
    emailOutcomeEvents,
    ["mailgun_signing_key"],
  ],
  [
    "sendgrid.inbound_parse",
    "SendGrid: Inbound Parse",
    "SendGrid",
    "email-provider",
    ["email.received"],
    [],
  ],
  [
    "sendgrid.events",
    "SendGrid: Event Webhook",
    "SendGrid",
    "email-provider",
    emailOutcomeEvents,
    [],
  ],
  [
    "postmark.inbound",
    "Postmark: inbound",
    "Postmark",
    "email-provider",
    emailOutcomeEvents,
    [],
  ],
  [
    "ses.sns",
    "Amazon SES via SNS",
    "Amazon SES",
    "email-provider",
    emailOutcomeEvents,
    [],
  ],
  [
    "resend.events",
    "Resend: webhook events",
    "Resend",
    "email-provider",
    emailOutcomeEvents,
    ["resend_signing_secret"],
  ],
  [
    "slack.incoming_webhook",
    "Slack: incoming webhook",
    "Slack",
    "chat",
    ["email.received", "email.bounced", "sms.inbound", "webhook.failed"],
    [],
  ],
  [
    "discord.webhook",
    "Discord: webhook embed",
    "Discord",
    "chat",
    ["email.received", "sms.inbound", "webhook.failed"],
    [],
  ],
  [
    "teams.adaptive_card",
    "Microsoft Teams: Adaptive Card",
    "Microsoft Teams",
    "chat",
    ["email.received", "webhook.failed"],
    [],
  ],
  [
    "telegram.send_message",
    "Telegram: bot message",
    "Telegram",
    "chat",
    ["email.received", "sms.inbound"],
    ["telegram_bot_token", "telegram_chat_id"],
  ],
  [
    "n8n.flat_json",
    "n8n / Zapier / Make: flat JSON",
    "Automation",
    "automation",
    ["email.received", "sms.sent", "sms.inbound"],
    [],
  ],
];

export function buildWebhookTemplateFixtures(): WebhookTemplateSummary[] {
  const builtinTemplates = builtinTemplateSpecs.map(
    ([id, name, service, category, events, requiredVariables]) => ({
      id,
      name,
      service,
      category,
      source: "builtin" as const,
      events,
      description: `${name} payload, matching the provider's documented format.`,
      required_variables: requiredVariables,
      revision: 1,
    }),
  );

  const customTemplates: WebhookTemplateSummary[] = [
    {
      id: "custom.tenant_inbound",
      name: "Postmark inbound with tenant header",
      service: "Postmark",
      category: "custom",
      source: "custom",
      events: ["email.received"],
      description: "Clone of Postmark inbound that adds an X-Tenant header.",
      required_variables: ["tenant_id"],
      revision: 3,
    },
    {
      id: "custom.ops_alert",
      name: "Ops alert (plain text)",
      service: "Custom",
      category: "custom",
      source: "file",
      events: ["webhook.failed"],
      description: "Loaded from ./sendmock-templates/ops-alert.toml.",
      required_variables: [],
      revision: 1,
    },
  ];

  return [...builtinTemplates, ...customTemplates];
}

type VariableSpec = Pick<
  WebhookVariable,
  "name" | "kind" | "value" | "description"
> & {
  randomMode?: WebhookVariable["random_mode"];
};

const variableSpecs: VariableSpec[] = [
  {
    name: "tenant_id",
    kind: "text",
    value: "acme",
    description: "Tenant sent with every request.",
  },
  {
    name: "priority",
    kind: "number",
    value: "5",
    description: "Numeric priority field.",
  },
  {
    name: "sandbox",
    kind: "boolean",
    value: "true",
    description: "Marks payloads as sandbox traffic.",
  },
  {
    name: "meta",
    kind: "json",
    value: '{"env":"local"}',
    description: "Extra metadata object.",
  },
  {
    name: "api_token",
    kind: "secret",
    value: "••••••••3f9a",
    description: "Bearer token for the app.",
  },
  {
    name: "recipient",
    kind: "dynamic",
    value: "data.to[0].address | lower",
    description: "First recipient, lowercased.",
  },
  {
    name: "nonce",
    kind: "random",
    value: "random_string(16)",
    description: "Fresh nonce per send.",
    randomMode: "per_send",
  },
  {
    name: "full_ref",
    kind: "computed",
    value: "{{ vars.tenant_id }}-{{ vars.nonce }}",
    description: "Tenant plus nonce.",
  },
  {
    name: "reason",
    kind: "prompt",
    value: "manual test",
    description: "Asked for on manual sends.",
  },
];

export function buildWebhookVariableFixtures(): WebhookVariable[] {
  return variableSpecs.map((variableSpec) => ({
    id: createMockUlid(),
    name: variableSpec.name,
    kind: variableSpec.kind,
    scope: "global",
    endpoint_id: null,
    value: variableSpec.value,
    random_mode: variableSpec.randomMode ?? null,
    description: variableSpec.description,
    created_by: "ui",
  }));
}

export function buildSavedDeliveryFixtures(): SavedDelivery[] {
  return [
    {
      id: createMockUlid(),
      name: "Twilio STOP reply",
      endpoint_id: null,
      template_id: "twilio.inbound_sms",
      request: {
        method: "POST",
        url: "http://localhost:8000/sms/inbound",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "From=%2B61400000000&To=%2B15550002222&Body=STOP",
      },
      saved_at: minutesAgo(300),
    },
  ];
}
