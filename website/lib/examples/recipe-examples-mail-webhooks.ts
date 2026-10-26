/** The "In your code" examples of the mail, webhook and setup recipes (WS-08.1). */
import { type CodeExample, ref } from "./example-types";

const waitTimeout = "10s";

export const mailAndWebhookRecipeExamples: CodeExample[] = [
  {
    page: "recipes/password-reset-email.md",
    heading: "In your code",
    intro:
      "A test that asks your app for a password reset, waits for the email and reads its reset link.",
    testName: "sends a password reset link",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/forgot-password",
        body: { email: "rahim@example.test" },
        note: "request a password reset for rahim@example.test",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/email",
        query: {
          to: "rahim@example.test",
          subject: "Reset your password",
          timeout: waitTimeout,
        },
        answerName: "email",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/links",
        query: { to: "rahim@example.test" },
        answerName: "links",
      },
      {
        kind: "app",
        method: "POST",
        path: "/reset-password",
        body: { link: ref("links", "links.0"), password: "a-new-password" },
        note: "open the first link and choose a new password",
      },
      {
        kind: "expect",
        answerName: "email",
        fieldPath: "subject",
        value: "Reset your password",
      },
    ],
  },
  {
    page: "recipes/read-a-code.md",
    heading: "In your code",
    intro:
      "A test that signs up, waits for the emailed code and finishes the sign-up with it. For an SMS code, pass the phone number as `to` and `sms` as `channel`.",
    testName: "signs up with the emailed code",
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
        path: "/api/v1/otp",
        query: { to: "user@example.test", timeout: waitTimeout },
        answerName: "otp",
      },
      {
        kind: "app",
        method: "POST",
        path: "/verify",
        body: { code: ref("otp", "code") },
        note: "enter the code",
      },
      {
        kind: "expect",
        answerName: "otp",
        fieldPath: "channel",
        value: "email",
      },
    ],
  },
  {
    page: "recipes/bounces-and-complaints.md",
    heading: "In your code",
    intro:
      "A test that makes an invitation bounce and checks the bounce reached your app's webhook.",
    testName: "handles a hard bounce",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/invitations",
        body: { email: "sam@example.test" },
        note: "invite sam@example.test",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/email",
        query: { to: "sam@example.test", timeout: waitTimeout },
        answerName: "email",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/emails/{emailId}/simulate",
        pathValues: { emailId: ref("email", "id") },
        body: { event: "bounced", bounce_type: "hard" },
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/webhook",
        query: { event: "email.bounced", timeout: waitTimeout },
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
    page: "recipes/inbound-email.md",
    heading: "In your code",
    intro:
      "A test that sends an email to the support inbox and checks it was posted to your inbound handler in Postmark's format.",
    testName: "posts a support email to the inbound handler",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/send",
        body: {
          from: "Sam <sam@customer.test>",
          to: ["support@yourapp.test"],
          subject: "Order arrived damaged",
          text: "The box was crushed, can I get a replacement?",
        },
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/webhook",
        query: {
          endpoint: "Postmark inbound",
          event: "email.received",
          timeout: waitTimeout,
        },
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
    page: "recipes/reply-by-email.md",
    heading: "In your code",
    intro:
      "A test that answers a ticket notification as its recipient; the inbound route posts the reply to your handler.",
    testName: "posts a ticket reply to the handler",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/tickets/318/notify",
        note: "email the ticket update to rahim@example.test",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/email",
        query: { to: "rahim@example.test", timeout: waitTimeout },
        answerName: "email",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/emails/{emailId}/reply",
        pathValues: { emailId: ref("email", "id") },
        body: { body: "Thanks, that fixed it." },
        answerName: "reply",
      },
      {
        kind: "expect",
        answerName: "reply",
        fieldPath: "direction",
        value: "inbound",
      },
    ],
  },
  {
    page: "recipes/replay-a-failed-webhook.md",
    heading: "In your code",
    intro:
      "A script that finds the newest failed delivery and sends the same request again after you fixed the handler.",
    testName: "replays the newest failed delivery",
    steps: [
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/webhooks/deliveries",
        query: { status: "failed", limit: "1" },
        answerName: "failures",
      },
      {
        kind: "pick",
        answerName: "failure",
        fromAnswer: "failures",
        fieldPath: "items.0",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/webhooks/deliveries/{deliveryId}/replay",
        pathValues: { deliveryId: ref("failure", "id") },
        body: { rerender: false },
        answerName: "replay",
      },
      {
        kind: "expect",
        answerName: "replay",
        fieldPath: "trigger",
        value: "replay",
      },
    ],
  },
  {
    page: "recipes/share-your-setup.md",
    heading: "In your code",
    intro:
      "Run this before each test: traffic is deleted and the configuration is the seed file's again.",
    testName: "starts from the seed",
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
    ],
  },
];
