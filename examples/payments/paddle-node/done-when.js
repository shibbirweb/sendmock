// AC: PY-10.3
// An app on Paddle Billing against a running SendMock: it creates a transaction with Paddle's
// documented request, the customer pays it on the checkout page, and every notification the
// app receives is unmarshalled with the official Node SDK (`@paddle/paddle-node-sdk`), which
// checks `Paddle-Signature`: `transaction.completed` for the paid transaction,
// `transaction.payment_failed` for a declined card and `adjustment.created` for a refund.
import { once } from "node:events";
import { createServer } from "node:http";

import { Environment, Paddle } from "@paddle/paddle-node-sdk";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026",
);
const apiKey = "pdl_sdbx_apikey_sendmock_SendMockPaddleKey01";
const notificationSecret = "pdl_ntfset_sendmock_SendMockPaddleSecret01";
const waitTimeoutMs = 60_000;
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

const paddle = new Paddle(apiKey, { environment: Environment.sandbox });

async function callJson(url, method, requestBody, headers) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(
      `${method} ${url} answered ${response.status}: ${answerText}`,
    );
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

function callSendMock(method, path, requestBody) {
  return callJson(`${sendmockUrl}/api/v1${path}`, method, requestBody, {});
}

/** Paddle's API at its real paths on the provider port, with the API key as a Bearer token. */
async function callPaddle(method, path, requestBody) {
  const answer = await callJson(
    `${providerUrl.origin}${path}`,
    method,
    requestBody,
    {
      Authorization: `Bearer ${apiKey}`,
    },
  );
  return answer.data;
}

function expectEqual(actualValue, expectedValue, description) {
  if (actualValue !== expectedValue) {
    throw new Error(
      `${description}: expected ${expectedValue}, got ${actualValue}`,
    );
  }
}

/** The app's webhook route: it keeps the events the SDK unmarshals. */
async function startWebhookReceiver() {
  const receiver = { receivedEvents: [], refusals: [] };
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", async () => {
      const rawBody = Buffer.concat(bodyChunks).toString("utf8");
      const signature = request.headers["paddle-signature"] ?? "";
      try {
        const webhookEvent = await paddle.webhooks.unmarshal(
          rawBody,
          notificationSecret,
          signature,
        );
        if (!webhookEvent) {
          throw new Error("unmarshal answered nothing");
        }
        receiver.receivedEvents.push(webhookEvent);
        response.writeHead(200);
        response.end();
      } catch (unmarshalError) {
        receiver.refusals.push(
          `${JSON.parse(rawBody).event_type}: ${unmarshalError.message}`,
        );
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("The Paddle SDK refused the notification");
      }
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  receiver.receiverServer = receiverServer;
  receiver.receiverUrl = `http://127.0.0.1:${receiverServer.address().port}/webhooks/paddle`;
  return receiver;
}

/** Points the Paddle gateway's notifications at the receiver. */
async function connectReceiver(receiver) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "Paddle notifications",
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
  const paddleGateway = await callSendMock("GET", "/payments/gateways/paddle");
  await callSendMock("PATCH", "/payments/gateways/paddle", {
    ...paddleGateway,
    notification_endpoint_id: endpoint.id,
  });
}

async function waitForEvent(receiver, eventType, entityId) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const webhookEvent = receiver.receivedEvents.find(
      (receivedEvent) =>
        receivedEvent.eventType === eventType &&
        [receivedEvent.data?.id, receivedEvent.data?.transactionId].includes(
          entityId,
        ),
    );
    if (webhookEvent) {
      return webhookEvent;
    }
    if (Date.now() > deadline) {
      const receivedTypes = receiver.receivedEvents.map(
        (receivedEvent) => receivedEvent.eventType,
      );
      throw new Error(
        `Timed out waiting for ${eventType}; received ${receivedTypes.join(", ")}; refused ${receiver.refusals.join(" / ")}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Creates a transaction with a non-catalog price and pays its checkout with the card. */
async function payTransaction(cardNumber) {
  currentStep = `create a transaction for ${cardNumber}`;
  const transaction = await callPaddle("POST", "/transactions", {
    items: [
      {
        quantity: 1,
        price: {
          description: "Pro plan, one month",
          name: "Pro",
          unit_price: { amount: "2500", currency_code: "USD" },
          product: { name: "Pro plan", tax_category: "standard" },
        },
      },
    ],
    custom_data: { account: "acme" },
  });
  expectEqual(transaction.status, "ready", "The new transaction's status");
  const checkoutId = new URL(transaction.checkout.url).pathname
    .split("/")
    .pop();
  currentStep = `pay transaction ${transaction.id} on the checkout page`;
  await callSendMock("POST", `/checkout-sessions/${checkoutId}/complete`, {
    action: "pay",
    method_key: "card",
    card: { number: cardNumber, exp_month: 12, exp_year: 2030, cvc: "123" },
  });
  return transaction.id;
}

async function main() {
  const receiver = await startWebhookReceiver();
  await connectReceiver(receiver);

  const paidId = await payTransaction("4242424242424242");
  currentStep = "receive transaction.completed";
  await waitForEvent(receiver, "transaction.completed", paidId);
  const paidTransaction = await callPaddle("GET", `/transactions/${paidId}`);
  expectEqual(
    paidTransaction.status,
    "completed",
    "The paid transaction's status",
  );

  const declinedId = await payTransaction("4000000000000002");
  currentStep = "receive transaction.payment_failed";
  await waitForEvent(receiver, "transaction.payment_failed", declinedId);

  currentStep = "refund the paid transaction";
  const adjustment = await callPaddle("POST", "/adjustments", {
    action: "refund",
    type: "full",
    transaction_id: paidId,
    reason: "Customer asked",
  });
  expectEqual(adjustment.status, "approved", "The refund's status");
  currentStep = "receive adjustment.created";
  await waitForEvent(receiver, "adjustment.created", adjustment.id);

  const receivedTypes = receiver.receivedEvents.map(
    (receivedEvent) => receivedEvent.eventType,
  );
  console.log(
    `Done: unmarshalled ${receivedTypes.length} Paddle events (${receivedTypes.join(", ")}).`,
  );
  receiver.receiverServer.close();
}

main().catch((error) => {
  console.error(error);
  // CI job logs need a token to read; an annotation shows the reason on the run itself.
  const reason = `step: ${currentStep} | ${error.message}`;
  console.log(`::error title=Paddle app::${reason.replace(/\r?\n/g, " ")}`);
  process.exit(1);
});
