// The Phase 3 done-when check against a running SendMock: a rule forwards every
// `*@inbound.local` email to this Express handler, the delivery log shows the request and the
// response, a failed delivery is retried, and after the handler is fixed a replay succeeds.
import { once } from "node:events";

import { buildWebhookApp } from "./webhook-handler.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const waitTimeoutMs = 60_000;

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

async function waitFor(description, readValue) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const value = await readValue();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function startHandler() {
  let webhookSecret = "";
  const { webhookApp, handlerState } = buildWebhookApp(() => webhookSecret);
  const handlerServer = webhookApp.listen(0, "127.0.0.1");
  await once(handlerServer, "listening");
  return {
    handlerServer,
    handlerState,
    handlerUrl: `http://127.0.0.1:${handlerServer.address().port}/webhooks/mail`,
    setSecret: (secret) => {
      webhookSecret = secret;
    },
  };
}

/** An endpoint that tries twice, a second apart, and a rule for inbound mail. */
async function connectHandler(handlerUrl) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "Express handler",
    url: handlerUrl,
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
  await callSendMock("POST", "/webhooks/rules", {
    name: "Inbound mail to Express",
    endpoint_id: endpoint.id,
    events: ["email.received"],
    filter: { all: [{ field: "to", operator: "matches", value: "*@inbound.local" }] },
    is_enabled: true,
  });
  const { secret } = await callSendMock("GET", `/webhooks/endpoints/${endpoint.id}/secret`);
  return { endpointId: endpoint.id, secret };
}

async function listDeliveries(endpointId) {
  const deliveryPage = await callSendMock("GET", `/webhooks/deliveries?endpoint_id=${endpointId}`);
  return deliveryPage.items ?? [];
}

async function main() {
  const handler = await startHandler();
  handler.handlerState.isBroken = true;
  const { endpointId, secret } = await connectHandler(handler.handlerUrl);
  handler.setSecret(secret);

  await callSendMock("POST", "/send", {
    from: "shop@example.test",
    to: ["orders@inbound.local"],
    subject: "Order 1001",
    text: "A new order arrived.",
  });
  await callSendMock("POST", "/send", {
    from: "shop@example.test",
    to: ["someone@example.test"],
    subject: "Not for the handler",
    text: "The rule's filter leaves this one out.",
  });

  const exhaustedDelivery = await waitFor("the retried delivery to give up", async () =>
    (await listDeliveries(endpointId)).find((delivery) => delivery.status === "exhausted"),
  );
  const failedAttempts = await listDeliveries(endpointId);
  if (failedAttempts.length !== 2 || failedAttempts.some((delivery) => delivery.response?.status_code !== 500)) {
    throw new Error(`Expected two failed attempts: ${JSON.stringify(failedAttempts)}`);
  }
  if (!exhaustedDelivery.request?.headers?.["webhook-signature"]) {
    throw new Error("The delivery log does not show the signed request");
  }

  handler.handlerState.isBroken = false;
  await callSendMock("POST", `/webhooks/deliveries/${exhaustedDelivery.id}/replay`, { rerender: false });
  const succeededDelivery = await waitFor("the replay to succeed", async () =>
    (await listDeliveries(endpointId)).find((delivery) => delivery.status === "succeeded"),
  );

  if (handler.handlerState.acceptedEvents.length !== 1) {
    throw new Error(`The handler accepted ${handler.handlerState.acceptedEvents.length} events`);
  }
  const acceptedEvent = handler.handlerState.acceptedEvents[0];
  if (acceptedEvent.type !== "email.received" || acceptedEvent.data?.subject !== "Order 1001") {
    throw new Error(`Unexpected event: ${JSON.stringify(acceptedEvent)}`);
  }
  console.log(
    `Done: ${failedAttempts.length} failed attempts, then the replay answered ${succeededDelivery.response?.status_code}.`,
  );
  handler.handlerServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
