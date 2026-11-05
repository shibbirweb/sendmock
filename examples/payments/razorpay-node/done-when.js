// AC: PY-10.2
// An app using Razorpay's official Node SDK (`razorpay`) against a running SendMock: it
// creates an order, the customer pays it on the checkout page, and the app checks the
// `razorpay_signature` posted back with the SDK's `validatePaymentVerification`, fetches the
// captured payment and receives `payment.captured`, checked with `validateWebhookSignature`.
// A declined card sends `payment.failed`, and the paid payment is refunded with
// `refund.processed` received and checked the same way.
//
// The SDK only knows https://api.razorpay.com, so the app points the SDK's HTTP client at
// SendMock's provider port, where SendMock answers Razorpay's real paths.
import { once } from "node:events";
import { createServer } from "node:http";

import Razorpay from "razorpay";
import razorpayUtils from "razorpay/dist/utils/razorpay-utils.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026",
);
const keyId = "rzp_test_SendMock0001";
const keySecret = "sendmockRazorpayKeySecret01";
const webhookSecret = "sendmock_razorpay_webhook_secret";
const callbackUrl = "https://shop.example/razorpay/callback";
const waitTimeoutMs = 60_000;
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
razorpay.api.rq.defaults.baseURL = providerUrl.origin;

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(
      `${method} ${path} answered ${response.status}: ${answerText}`,
    );
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

function expectEqual(actualValue, expectedValue, description) {
  if (actualValue !== expectedValue) {
    throw new Error(
      `${description}: expected ${expectedValue}, got ${actualValue}`,
    );
  }
}

/** The app's webhook route: it keeps the events whose signature the SDK accepts. */
async function startWebhookReceiver() {
  const receiver = { receivedEvents: [] };
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", () => {
      const rawBody = Buffer.concat(bodyChunks).toString("utf8");
      const signature = request.headers["x-razorpay-signature"] ?? "";
      if (
        !razorpayUtils.validateWebhookSignature(
          rawBody,
          signature,
          webhookSecret,
        )
      ) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("validateWebhookSignature refused the webhook");
        return;
      }
      receiver.receivedEvents.push(JSON.parse(rawBody));
      response.writeHead(200);
      response.end();
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  receiver.receiverServer = receiverServer;
  receiver.receiverUrl = `http://127.0.0.1:${receiverServer.address().port}/webhooks/razorpay`;
  return receiver;
}

/** Points the Razorpay gateway's webhooks at the receiver. */
async function connectReceiver(receiver) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "Razorpay webhooks",
    url: receiver.receiverUrl,
    is_enabled: true,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 10_000,
    retry_policy: {
      max_attempts: 2,
      backoff_seconds: [1],
      retry_on_client_errors: false,
    },
    query_params: [],
    body_mode: "template",
    body_fields: [],
    fields_encoding: "json",
    raw_content_type: "application/json",
    raw_body: "",
    render_mode: "strict",
  });
  const razorpayGateway = await callSendMock(
    "GET",
    "/payments/gateways/razorpay",
  );
  await callSendMock("PATCH", "/payments/gateways/razorpay", {
    ...razorpayGateway,
    notification_endpoint_id: endpoint.id,
  });
}

async function waitForEvent(receivedEvents, eventName, paymentId) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const webhookEvent = receivedEvents.find(
      (receivedEvent) =>
        receivedEvent.event === eventName &&
        receivedEvent.payload?.payment?.entity?.id === paymentId,
    );
    if (webhookEvent) {
      return webhookEvent;
    }
    if (Date.now() > deadline) {
      const receivedNames = receivedEvents.map(
        (receivedEvent) => receivedEvent.event,
      );
      throw new Error(
        `Timed out waiting for ${eventName}; received ${receivedNames.join(", ")}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Creates an order and pays it on the checkout page with the card; answers the session. */
async function payOrderOnPage(receipt, cardNumber) {
  currentStep = `create order ${receipt}`;
  const order = await razorpay.orders.create({
    amount: 50_000,
    currency: "INR",
    receipt,
    notes: { callback_url: callbackUrl },
  });
  expectEqual(order.status, "created", "The new order's status");
  const payments = await callSendMock("GET", "/payments?provider=razorpay");
  const payment = payments.items.find(
    (listedPayment) => listedPayment.provider_reference === order.id,
  );
  currentStep = `pay order ${receipt} on the checkout page`;
  const session = await callSendMock(
    "POST",
    `/checkout-sessions/${payment.id}/complete`,
    {
      action: "pay",
      method_key: "card",
      card: { number: cardNumber, exp_month: 12, exp_year: 2030, cvc: "123" },
    },
  );
  return { order, session };
}

async function payAndVerify(receivedEvents) {
  const { order, session } = await payOrderOnPage(
    "order-3001",
    "4242424242424242",
  );
  const checkoutFields = session.redirect.fields;
  currentStep = "check razorpay_signature with validatePaymentVerification";
  const isGenuine = razorpayUtils.validatePaymentVerification(
    { order_id: order.id, payment_id: checkoutFields.razorpay_payment_id },
    checkoutFields.razorpay_signature,
    keySecret,
  );
  expectEqual(isGenuine, true, "validatePaymentVerification");
  currentStep = "fetch the captured payment";
  const payment = await razorpay.payments.fetch(
    checkoutFields.razorpay_payment_id,
  );
  expectEqual(payment.status, "captured", "The paid payment's status");
  currentStep = "receive payment.captured";
  await waitForEvent(receivedEvents, "payment.captured", payment.id);
  return payment.id;
}

async function handleDecline(receivedEvents) {
  await payOrderOnPage("order-3002", "4000000000000002");
  currentStep = "receive payment.failed";
  const deadline = Date.now() + waitTimeoutMs;
  while (
    !receivedEvents.some(
      (receivedEvent) => receivedEvent.event === "payment.failed",
    )
  ) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for payment.failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function refundPayment(receivedEvents, paymentId) {
  currentStep = "refund the payment";
  const refund = await razorpay.payments.refund(paymentId, { amount: 20_000 });
  expectEqual(refund.status, "processed", "The refund's status");
  currentStep = "fetch the refund";
  const fetchedRefund = await razorpay.refunds.fetch(refund.id);
  expectEqual(fetchedRefund.amount, 20_000, "The fetched refund's amount");
  currentStep = "receive refund.processed";
  await waitForEvent(receivedEvents, "refund.processed", paymentId);
}

async function main() {
  const receiver = await startWebhookReceiver();
  await connectReceiver(receiver);

  const paymentId = await payAndVerify(receiver.receivedEvents);
  await handleDecline(receiver.receivedEvents);
  await refundPayment(receiver.receivedEvents, paymentId);

  const receivedNames = receiver.receivedEvents.map(
    (receivedEvent) => receivedEvent.event,
  );
  console.log(
    `Done: verified ${receivedNames.length} Razorpay events (${receivedNames.join(", ")}).`,
  );
  receiver.receiverServer.close();
}

main().catch((error) => {
  console.error(error);
  // CI job logs need a token to read; an annotation shows the reason on the run itself.
  const reason = [
    `step: ${currentStep}`,
    error.message,
    JSON.stringify(error.error ?? ""),
  ]
    .filter(Boolean)
    .join(" | ");
  console.log(`::error title=Razorpay app::${reason.replace(/\r?\n/g, " ")}`);
  process.exit(1);
});
