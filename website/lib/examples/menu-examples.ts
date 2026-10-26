/** The "From your code" example of every sidebar menu page (WS-08.2). */
import { type CodeExample, ref } from "./example-types";

const waitTimeout = "10s";

const sampleScenario = [
  'name = "sample-sms"',
  "",
  "[[steps]]",
  'run = "sample.send"',
  'with = { kind = "sms" }',
].join("\n");

export const menuExamples: CodeExample[] = [
  {
    page: "overview.md",
    heading: "From your code",
    intro:
      "Start a test from a clean slate and read the numbers the Overview shows.",
    testName: "starts with empty counts",
    steps: [
      { kind: "api", method: "POST", path: "/api/v1/reset" },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/stats",
        answerName: "stats",
      },
      {
        kind: "expect",
        answerName: "stats",
        fieldPath: "email_count",
        value: 0,
      },
      { kind: "expect", answerName: "stats", fieldPath: "sms_count", value: 0 },
    ],
  },
  {
    page: "mail/index.md",
    heading: "From your code",
    intro:
      "Wait for the email your app just sent, the way most tests use Mail.",
    testName: "sends a welcome email",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/register",
        body: { email: "user@example.test" },
        note: "sign up as user@example.test",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/email",
        query: {
          to: "user@example.test",
          subject: "Welcome",
          timeout: waitTimeout,
        },
        answerName: "email",
      },
      {
        kind: "expect",
        answerName: "email",
        fieldPath: "is_read",
        value: false,
      },
    ],
  },
  {
    page: "sms/index.md",
    heading: "From your code",
    intro: "Send an SMS with the native API and read how it was encoded.",
    testName: "sends an SMS",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/sms",
        body: {
          from: "+15550001111",
          to: "+8801700000000",
          body: "Your code is 482913",
        },
        answerName: "sms",
      },
      { kind: "expect", answerName: "sms", fieldPath: "segments", value: 1 },
      {
        kind: "expect",
        answerName: "sms",
        fieldPath: "encoding",
        value: "GSM-7",
      },
    ],
  },
  {
    page: "http/index.md",
    heading: "From your code",
    intro:
      "Create a bin that answers like Firebase Cloud Messaging, then point your app's push base URL at its catch URL.",
    testName: "creates a push bin",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/http/bins",
        body: { name: "push", preset: "fcm" },
        answerName: "bin",
      },
      { kind: "expect", answerName: "bin", fieldPath: "name", value: "push" },
    ],
  },
  {
    page: "webhooks/index.md",
    heading: "From your code",
    intro:
      "Wait for the delivery an email triggers and check your handler accepted it.",
    testName: "delivers the received email to the handler",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/orders/42/confirm",
        note: "email the order confirmation",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/webhook",
        query: { event: "email.received", timeout: waitTimeout },
        answerName: "delivery",
      },
      {
        kind: "expect",
        answerName: "delivery",
        fieldPath: "status",
        value: "succeeded",
      },
    ],
  },
  {
    page: "payments/index.md",
    heading: "From your code",
    intro:
      "Create a test checkout, settle it from the test and read the payment.",
    testName: "settles a test payment",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/payments/checkout",
        body: { provider: "stripe", amount_minor: 1999, currency: "USD" },
        answerName: "payment",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/payments/{paymentId}/simulate",
        pathValues: { paymentId: ref("payment", "id") },
        body: { action: "succeed" },
        answerName: "paid",
      },
      {
        kind: "expect",
        answerName: "paid",
        fieldPath: "status",
        value: "succeeded",
      },
    ],
  },
  {
    page: "numbers.md",
    heading: "From your code",
    intro:
      "Register your app's sending number with its reply webhook, as the test setup.",
    testName: "registers the support number",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/numbers",
        body: {
          number: "+15550001111",
          label: "Support line",
          channels: ["sms"],
          inbound_url: "http://localhost:3000/sms/inbound",
          inbound_method: "POST",
        },
        answerName: "number",
      },
      {
        kind: "expect",
        answerName: "number",
        fieldPath: "number",
        value: "+15550001111",
      },
    ],
  },
  {
    page: "scenarios.md",
    heading: "From your code",
    intro: "Run a scenario from a test and check every step passed.",
    testName: "runs the sample scenario",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/scenarios/run",
        body: { scenario: sampleScenario },
        answerName: "report",
      },
      {
        kind: "expect",
        answerName: "report",
        fieldPath: "is_passed",
        value: true,
      },
    ],
  },
  {
    page: "logs.md",
    heading: "From your code",
    intro:
      "List the SMTP sessions that failed, for example after a test that expects your app to retry.",
    testName: "lists failed SMTP sessions",
    steps: [
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/logs/smtp",
        query: { result: "failed" },
        answerName: "sessions",
      },
      {
        kind: "pick",
        answerName: "session",
        fromAnswer: "sessions",
        fieldPath: "items.0",
      },
      {
        kind: "expect",
        answerName: "session",
        fieldPath: "result",
        value: "failed",
      },
    ],
  },
  {
    page: "settings.md",
    heading: "From your code",
    intro:
      "Change a setting for one test, for example a 10% random SMS failure rate.",
    testName: "fails one SMS in ten",
    steps: [
      {
        kind: "api",
        method: "PATCH",
        path: "/api/v1/settings",
        body: { sms_failure_rate_percent: 10 },
        answerName: "settings",
      },
      {
        kind: "expect",
        answerName: "settings",
        fieldPath: "sms_failure_rate_percent",
        value: 10,
      },
    ],
  },
];
