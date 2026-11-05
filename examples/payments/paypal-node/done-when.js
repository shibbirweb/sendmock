// AC: PY-05.1 PY-05.2
// An app using PayPal's official Node SDK (`@paypal/paypal-server-sdk`) against a running
// SendMock: it creates an order, the buyer approves it on the checkout page, the app captures
// it and receives `PAYMENT.CAPTURE.COMPLETED`, checked with `verify-webhook-signature`; an
// order the buyer's card declines fails at capture with `INSTRUMENT_DECLINED`; and the capture
// is refunded, with `PAYMENT.CAPTURE.REFUNDED` received and checked the same way.
//
// The SDK only knows PayPal's own hosts, so its HTTP client goes through SendMock's provider
// port as a plain HTTP proxy: the SDK still asks for https://api-m.sandbox.paypal.com/..., and
// SendMock answers at PayPal's real paths without anything leaving the machine.
import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
} from "@paypal/paypal-server-sdk";

import { startPayPalWebhookReceiver } from "./paypal-webhook-receiver.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026");
const paypalApi = {
  providerUrl: providerUrl.origin,
  clientId: "sendmock-example-client",
  clientSecret: "sendmock-example-secret",
};
const waitTimeoutMs = 60_000;

const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: paypalApi.clientId,
    oAuthClientSecret: paypalApi.clientSecret,
  },
  environment: Environment.Sandbox,
  timeout: 10_000,
  unstable_httpClientOptions: {
    proxy: { protocol: "http", host: providerUrl.hostname, port: Number(providerUrl.port) },
  },
});
const ordersController = new OrdersController(paypalClient);
const paymentsController = new PaymentsController(paypalClient);

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

function expectEqual(actualValue, expectedValue, description) {
  if (actualValue !== expectedValue) {
    throw new Error(`${description}: expected ${expectedValue}, got ${actualValue}`);
  }
}

async function waitForEvent(receivedEvents, eventType, resourceId) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const webhookEvent = receivedEvents.find(
      (receivedEvent) =>
        receivedEvent.event_type === eventType && receivedEvent.resource?.id === resourceId,
    );
    if (webhookEvent) {
      return webhookEvent;
    }
    if (Date.now() > deadline) {
      const receivedTypes = receivedEvents.map((receivedEvent) => receivedEvent.event_type);
      throw new Error(`Timed out waiting for ${eventType}; received ${receivedTypes.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Points the PayPal gateway's webhooks at the receiver; its endpoint id is the webhook id. */
async function connectReceiver(receiver) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "PayPal webhooks",
    url: receiver.receiverUrl,
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
  const paypalGateway = await callSendMock("GET", "/payments/gateways/paypal");
  await callSendMock("PATCH", "/payments/gateways/paypal", {
    ...paypalGateway,
    notification_endpoint_id: endpoint.id,
  });
  receiver.webhookId = endpoint.id;
}

/** Creates an order and has the buyer approve or decline it on the checkout page. */
async function createOrderOnPage(shopOrderId, checkoutAction) {
  const { result: order } = await ordersController.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        { referenceId: shopOrderId, amount: { currencyCode: "USD", value: "25.00" } },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            returnUrl: "https://shop.example/paypal/return",
            cancelUrl: "https://shop.example/paypal/cancel",
          },
        },
      },
    },
    prefer: "return=representation",
  });
  expectEqual(order.status, "PAYER_ACTION_REQUIRED", "The new order's status");
  const approvalLink = order.links.find((link) => ["payer-action", "approve"].includes(link.rel));
  const paymentId = new URL(approvalLink.href).pathname.split("/").pop();
  await callSendMock("POST", `/checkout-sessions/${paymentId}/complete`, {
    action: checkoutAction,
    method_key: "paypal_account",
  });
  return order.id;
}

async function payAndCapture(receivedEvents) {
  const orderId = await createOrderOnPage("order-2001", "pay");
  const { result: approvedOrder } = await ordersController.getOrder({ id: orderId });
  expectEqual(approvedOrder.status, "APPROVED", "The approved order's status");

  const { result: capturedOrder } = await ordersController.captureOrder({
    id: orderId,
    prefer: "return=representation",
    body: {},
  });
  expectEqual(capturedOrder.status, "COMPLETED", "The captured order's status");
  const capture = capturedOrder.purchaseUnits[0].payments.captures[0];
  expectEqual(capture.status, "COMPLETED", "The capture's status");
  await waitForEvent(receivedEvents, "PAYMENT.CAPTURE.COMPLETED", capture.id);
  return capture.id;
}

async function handleDecline() {
  const orderId = await createOrderOnPage("order-2002", "decline");
  try {
    await ordersController.captureOrder({ id: orderId, body: {} });
    throw new Error("A declined order was captured");
  } catch (captureError) {
    if (!(captureError instanceof ApiError)) {
      throw captureError;
    }
    expectEqual(captureError.statusCode, 422, "The declined capture's status code");
    const errorBody = JSON.parse(captureError.body);
    expectEqual(errorBody.details[0].issue, "INSTRUMENT_DECLINED", "The declined capture's issue");
  }
}

async function refundCapture(receivedEvents, captureId) {
  const { result: refund } = await paymentsController.refundCapturedPayment({
    captureId,
    prefer: "return=representation",
    body: {},
  });
  expectEqual(refund.status, "COMPLETED", "The refund's status");
  const { result: refundedCapture } = await paymentsController.getCapturedPayment({ captureId });
  expectEqual(refundedCapture.status, "REFUNDED", "The refunded capture's status");
  await waitForEvent(receivedEvents, "PAYMENT.CAPTURE.REFUNDED", refund.id);
}

async function main() {
  const receiver = await startPayPalWebhookReceiver(paypalApi);
  await connectReceiver(receiver);

  const captureId = await payAndCapture(receiver.receivedEvents);
  await handleDecline();
  await refundCapture(receiver.receivedEvents, captureId);

  const receivedTypes = receiver.receivedEvents.map((receivedEvent) => receivedEvent.event_type);
  console.log(`Done: verified ${receivedTypes.length} PayPal events (${receivedTypes.join(", ")}).`);
  receiver.receiverServer.close();
}

main().catch((error) => {
  console.error(error);
  // CI job logs need a token to read; an annotation shows the reason on the run itself.
  const reason = [error.message, error.body].filter(Boolean).join(" ");
  console.log(`::error title=PayPal app::${reason.replace(/\r?\n/g, " ")}`);
  process.exit(1);
});
