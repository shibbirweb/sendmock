import type { EventArea } from "./trailer-palette";

/**
 * Product facts shown in the trailer, copied from the app's mock data so the
 * film only claims what SendMock has: providers and accents from
 * web/src/mocks/fixtures/*-provider-fixtures.ts and payment-gateway-fixtures.ts,
 * templates from template-and-variable-fixtures.ts, events from
 * web/src/lib/api/types/events.ts, agents from mocks/automation/ai-agent-setups.ts,
 * platforms from docs/plan/09-distribution.md.
 */
export type BrandedName = {
  name: string;
  accent: string;
};

export const emailProviders: BrandedName[] = [
  { name: "SendGrid", accent: "#1a82e2" },
  { name: "Mailgun", accent: "#f06b66" },
  { name: "Postmark", accent: "#ffde00" },
  { name: "Resend", accent: "#e6edf3" },
  { name: "Amazon SES", accent: "#ff9900" },
  { name: "Brevo", accent: "#0b996e" },
];

export const smsProviders: BrandedName[] = [
  { name: "Twilio", accent: "#f22f46" },
  { name: "Twilio Verify", accent: "#f22f46" },
  { name: "Vonage", accent: "#871fff" },
  { name: "Plivo", accent: "#2fd477" },
  { name: "MessageBird", accent: "#2481d7" },
  { name: "SSL Wireless", accent: "#00a651" },
];

export const paymentGateways: BrandedName[] = [
  { name: "Stripe", accent: "#635bff" },
  { name: "PayPal", accent: "#ffc439" },
  { name: "SSLCommerz", accent: "#1e5bb8" },
  { name: "bKash", accent: "#e2136e" },
  { name: "Native", accent: "#0d9488" },
];

export const webhookTemplateNames = [
  "Native SendMock JSON",
  "Twilio: inbound SMS",
  "Twilio: status callback",
  "Vonage: inbound SMS",
  "Vonage: delivery receipt",
  "Plivo: inbound message",
  "Telnyx: message events",
  "Mailgun: routes",
  "SendGrid: Inbound Parse",
  "SendGrid: Event Webhook",
  "Postmark: inbound",
  "Amazon SES via SNS",
  "Resend: webhook events",
  "Slack: incoming webhook",
  "Discord: webhook embed",
  "Microsoft Teams: Adaptive Card",
  "Telegram: bot message",
];

export type EventGroup = {
  area: EventArea;
  title: string;
  eventNames: string[];
};

export const eventGroups: EventGroup[] = [
  {
    area: "email",
    title: "Email",
    eventNames: [
      "email.received",
      "email.inbound",
      "email.opened",
      "email.delivered",
      "email.deferred",
      "email.bounced",
      "email.complained",
      "email.unsubscribed",
      "email.released",
      "email.deleted",
    ],
  },
  {
    area: "sms",
    title: "SMS",
    eventNames: ["sms.sent", "sms.status", "sms.opened", "sms.inbound"],
  },
  {
    area: "verify",
    title: "Verify",
    eventNames: ["verify.started", "verify.checked", "verify.expired"],
  },
  {
    area: "payment",
    title: "Payments",
    eventNames: [
      "payment.created",
      "payment.authorized",
      "payment.succeeded",
      "payment.failed",
      "payment.canceled",
      "payment.refunded",
      "payment.partially_refunded",
      "payment.dispute_opened",
      "payment.dispute_closed",
    ],
  },
  {
    area: "checkout",
    title: "Checkout",
    eventNames: ["checkout.completed", "checkout.expired"],
  },
  {
    area: "http",
    title: "HTTP",
    eventNames: ["http.captured"],
  },
  {
    area: "webhook",
    title: "Webhooks",
    eventNames: ["webhook.delivered", "webhook.failed"],
  },
  {
    area: "test",
    title: "Test",
    eventNames: ["test.ping"],
  },
];

export const aiAgentNames = [
  "Claude Code",
  "Codex",
  "Cursor",
  "Gemini CLI",
  "VS Code",
];

export const languageNames = [
  "PHP",
  "Node",
  "Python",
  "Go",
  "Java",
  "Rust",
  "Ruby",
  ".NET",
];

/** The stable install commands, exactly as the docs Install page gives them (website/content/docs/install.md). */
export const installCommands = [
  "brew install shibbirweb/tap/sendmock",
  "curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh",
  "irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex",
  "docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock",
];
