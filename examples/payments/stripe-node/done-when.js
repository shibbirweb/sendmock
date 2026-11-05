// AC: PY-04.3 PY-04.4
// An app using the official `stripe` Node SDK against a running SendMock: it creates a
// Checkout Session, the customer pays on the checkout page, and the app receives
// `checkout.session.completed` and `payment_intent.succeeded`, each verified with
// `stripe.webhooks.constructEvent`; then a confirm with a declined card throws the SDK's
// `StripeCardError` and `payment_intent.payment_failed` arrives, and the paid PaymentIntent is
// refunded, sending `charge.refunded`. Every delivery is written to a file the PHP and Python
// SDKs verify next.
import { writeFileSync } from "node:fs";

import Stripe from "stripe";

import { startStripeWebhookReceiver } from "./stripe-webhook-receiver.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026");
const deliveriesPath = process.env.STRIPE_DELIVERIES_PATH ?? "../stripe-deliveries.json";
const webhookSecret = "whsec_sendmock0000000000000";
const waitTimeoutMs = 60_000;

const stripe = new Stripe("sk_test_sendmock_example", {
  host: providerUrl.hostname,
  port: Number(providerUrl.port),
  protocol: providerUrl.protocol.replace(":", ""),
});

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${answerText}`);
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

async function waitForEvent(receivedEvents, eventType) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const stripeEvent = receivedEvents.find((receivedEvent) => receivedEvent.type === eventType);
    if (stripeEvent) {
      return stripeEvent;
    }
    if (Date.now() > deadline) {
      const receivedTypes = receivedEvents.map((receivedEvent) => receivedEvent.type);
      throw new Error(`Timed out waiting for ${eventType}; received ${receivedTypes.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function expectEqual(actualValue, expectedValue, description) {
  if (actualValue !== expectedValue) {
    throw new Error(`${description}: expected ${expectedValue}, got ${actualValue}`);
  }
}

/** Points the Stripe gateway's notifications at the receiver, signed with a known secret. */
async function connectReceiver(receiverUrl) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "Stripe webhooks",
    url: receiverUrl,
    is_enabled: true,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 10_000,
    retry_policy: { max_attempts: 2, backoff_seconds: [1], retry_on_client_errors: false },
    query_params: [],
    body_mode: "template",
    body_fields: [],
    fields_encoding: "json",
    raw_content_type: "application/json",
    raw_body: "",
    render_mode: "strict",
  });
  const stripeGateway = await callSendMock("GET", "/payments/gateways/stripe");
  await callSendMock("PATCH", "/payments/gateways/stripe", {
    ...stripeGateway,
    notification_endpoint_id: endpoint.id,
    credentials: stripeGateway.credentials.map((credential) =>
      credential.name === "webhook_secret" ? { ...credential, value: webhookSecret } : credential,
    ),
  });
}

async function payCheckoutSession(receivedEvents) {
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: "https://shop.example/thanks?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://shop.example/cart",
    client_reference_id: "order-1001",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: 1500, product_data: { name: "T-shirt" } },
      },
    ],
  });
  const paymentId = new URL(checkoutSession.url).pathname.split("/").pop();
  await callSendMock("POST", `/checkout-sessions/${paymentId}/complete`, {
    action: "pay",
    method_key: "card",
    card: { number: "4242424242424242", exp_month: 12, exp_year: 2034 },
  });

  const completedEvent = await waitForEvent(receivedEvents, "checkout.session.completed");
  const succeededEvent = await waitForEvent(receivedEvents, "payment_intent.succeeded");
  const completedSession = completedEvent.data.object;
  expectEqual(completedSession.id, checkoutSession.id, "The completed session");
  expectEqual(completedSession.payment_status, "paid", "The session's payment status");
  expectEqual(completedSession.client_reference_id, "order-1001", "The client reference");
  expectEqual(succeededEvent.data.object.id, completedSession.payment_intent, "The paid intent");
  const retrievedSession = await stripe.checkout.sessions.retrieve(checkoutSession.id);
  expectEqual(retrievedSession.status, "complete", "The retrieved session's status");
  return completedSession.payment_intent;
}

async function refundPayment(receivedEvents, paymentIntentId) {
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  expectEqual(refund.status, "succeeded", "The refund's status");
  const refundedEvent = await waitForEvent(receivedEvents, "charge.refunded");
  const refundedCharge = refundedEvent.data.object;
  expectEqual(refundedCharge.payment_intent, paymentIntentId, "The refunded charge's intent");
  expectEqual(refundedCharge.refunded, true, "Whether the charge is refunded in full");
  expectEqual(refundedCharge.amount_refunded, 1500, "The refunded amount");
}

async function handleDeclinedCard(receivedEvents) {
  try {
    await stripe.paymentIntents.create({
      amount: 2000,
      currency: "usd",
      payment_method: "pm_card_chargeDeclined",
      confirm: true,
    });
    throw new Error("A declined card was accepted");
  } catch (stripeError) {
    if (!(stripeError instanceof Stripe.errors.StripeCardError)) {
      throw stripeError;
    }
    expectEqual(stripeError.code, "card_declined", "The decline's code");
    expectEqual(stripeError.decline_code, "generic_decline", "The decline code");
  }
  const failedEvent = await waitForEvent(receivedEvents, "payment_intent.payment_failed");
  expectEqual(failedEvent.data.object.status, "requires_payment_method", "The failed intent");
}

async function main() {
  const receiver = await startStripeWebhookReceiver(stripe, webhookSecret);
  await connectReceiver(receiver.receiverUrl);

  const paymentIntentId = await payCheckoutSession(receiver.receivedEvents);
  await handleDeclinedCard(receiver.receivedEvents);
  await refundPayment(receiver.receivedEvents, paymentIntentId);

  writeFileSync(
    deliveriesPath,
    JSON.stringify({ webhook_secret: webhookSecret, deliveries: receiver.receivedDeliveries }),
  );
  const receivedTypes = receiver.receivedEvents.map((receivedEvent) => receivedEvent.type);
  console.log(`Done: verified ${receivedTypes.length} Stripe events (${receivedTypes.join(", ")}).`);
  receiver.receiverServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
