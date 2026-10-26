/** The "In your code" examples of the SMS, HTTP and payment recipes (WS-08.1). */
import { type CodeExample, ref } from "./example-types";

const waitTimeout = "10s";

export const smsHttpAndPaymentRecipeExamples: CodeExample[] = [
  {
    page: "recipes/failed-sms.md",
    heading: "In your code",
    intro:
      "A test that marks a sent SMS undelivered with Twilio's `30007`, so your status callback handler runs. Sending to `+15005550103` does the same by itself.",
    testName: "handles an undelivered SMS",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/orders/42/notify",
        note: "text the order update to +8801700000000",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/sms",
        query: { to: "+8801700000000", timeout: waitTimeout },
        answerName: "sms",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/sms/{smsId}/status",
        pathValues: { smsId: ref("sms", "id") },
        body: { status: "undelivered", error_code: "30007" },
        answerName: "failed",
      },
      {
        kind: "expect",
        answerName: "failed",
        fieldPath: "status",
        value: "undelivered",
      },
      {
        kind: "expect",
        answerName: "failed",
        fieldPath: "error_code",
        value: "30007",
      },
    ],
  },
  {
    page: "recipes/slack-and-push.md",
    heading: "In your code",
    intro:
      "A test that fails an order and checks your app's Slack alert reached the `slack` bin, not the team.",
    testName: "posts the failed order to Slack",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/orders/42/fail",
        note: "fail order 42; your app posts to http://127.0.0.1:8025/catch/slack",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/http",
        query: { bin: "slack", method: "POST", timeout: waitTimeout },
        answerName: "alert",
      },
      {
        kind: "expect",
        answerName: "alert",
        fieldPath: "bin_name",
        value: "slack",
      },
      {
        kind: "expect",
        answerName: "alert",
        fieldPath: "response_status",
        value: 200,
      },
    ],
  },
  {
    page: "recipes/sslcommerz-bkash-checkout.md",
    heading: "In your code",
    intro:
      "A test that starts an SSLCommerz checkout and pays it with the test bKash wallet, as a customer would on the checkout page.",
    testName: "pays with a test bKash wallet",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/payments/checkout",
        body: { provider: "sslcommerz", amount_minor: 150000, currency: "BDT" },
        answerName: "payment",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/checkout-sessions/{sessionId}/complete",
        pathValues: { sessionId: ref("payment", "id") },
        body: {
          action: "pay",
          method_key: "bkash",
          entries: { number: "01770000001", otp: "123456", pin: "12121" },
        },
        answerName: "checkout",
      },
      {
        kind: "expect",
        answerName: "checkout",
        fieldPath: "state",
        value: "completed",
      },
    ],
  },
  {
    page: "recipes/stripe-payment.md",
    heading: "In your code",
    intro:
      "A test that starts a Stripe checkout, pays with the `4242` test card and waits for the payment to succeed.",
    testName: "pays with a test card",
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
        path: "/api/v1/checkout-sessions/{sessionId}/complete",
        pathValues: { sessionId: ref("payment", "id") },
        body: {
          action: "pay",
          method_key: "card",
          card: {
            number: "4242424242424242",
            exp_month: 12,
            exp_year: 2030,
            cvc: "123",
            holder_name: "Sam Tester",
          },
        },
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/payment",
        query: {
          provider: "stripe",
          status: "succeeded",
          timeout: waitTimeout,
        },
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
    page: "recipes/twilio-verify-login.md",
    heading: "In your code",
    intro:
      "A test that starts a login, expires the code and checks your app refuses it.",
    testName: "refuses an expired code",
    steps: [
      {
        kind: "app",
        method: "POST",
        path: "/login",
        body: { phone: "+8801700000000" },
        note: "start a login for +8801700000000",
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/verify",
        query: { to: "+8801700000000", status: "pending", limit: "1" },
        answerName: "pending",
      },
      {
        kind: "pick",
        answerName: "verification",
        fromAnswer: "pending",
        fieldPath: "items.0",
      },
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/verify/{verificationSid}/force",
        pathValues: { verificationSid: ref("verification", "sid") },
        body: { state: "expired" },
        answerName: "expired",
      },
      {
        kind: "app",
        method: "POST",
        path: "/login/verify",
        body: { code: ref("verification", "code") },
        note: "enter the old code; your app should refuse it",
      },
      {
        kind: "expect",
        answerName: "expired",
        fieldPath: "status",
        value: "expired",
      },
    ],
  },
  {
    page: "recipes/two-way-sms.md",
    heading: "In your code",
    intro:
      "A test that texts STOP to your app's number and waits for your app's answer.",
    testName: "answers STOP",
    steps: [
      {
        kind: "api",
        method: "POST",
        path: "/api/v1/sms/inbound",
        body: { from: "+8801700000000", to: "+15550001111", body: "STOP" },
      },
      {
        kind: "api",
        method: "GET",
        path: "/api/v1/wait/sms",
        query: {
          to: "+8801700000000",
          from: "+15550001111",
          timeout: waitTimeout,
        },
        answerName: "answer",
      },
      {
        kind: "expect",
        answerName: "answer",
        fieldPath: "direction",
        value: "outbound",
      },
    ],
  },
];
