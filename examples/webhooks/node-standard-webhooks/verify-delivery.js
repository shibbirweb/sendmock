// The official Standard Webhooks library for Node verifies a native delivery from SendMock:
// a rule sends an email.received webhook to a local receiver, which checks the signature
// with the endpoint's whsec_ secret and refuses a tampered body (WH-04.1).
import { once } from "node:events";
import { createServer } from "node:http";
import { Webhook } from "standardwebhooks";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const deliveryTimeoutMs = 30_000;

async function callSendMock(method, path, requestBody) {
  const sendmockResponse = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  if (!sendmockResponse.ok) {
    throw new Error(
      `${method} ${path} answered ${sendmockResponse.status}: ${await sendmockResponse.text()}`,
    );
  }

  return sendmockResponse.json();
}

/** A local app that keeps the first webhook it receives, body and headers as sent. */
async function startDeliveryReceiver() {
  let resolveDelivery;
  const firstDelivery = new Promise((resolve) => {
    resolveDelivery = resolve;
  });
  const receiver = createServer((request, response) => {
    let rawBody = "";
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    request.on("end", () => {
      resolveDelivery({ rawBody, headers: request.headers });
      response.writeHead(204).end();
    });
  });
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");

  return {
    receiver,
    receiverUrl: `http://127.0.0.1:${receiver.address().port}/webhooks`,
    firstDelivery,
  };
}

/** An endpoint for the receiver with a rule for every received email; answers its secret. */
async function connectEndpoint(receiverUrl) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "Node verifier",
    url: receiverUrl,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 10_000,
    retry_policy: {
      max_attempts: 1,
      backoff_seconds: [1],
      retry_on_client_errors: false,
    },
    is_enabled: true,
    query_params: [],
    body_mode: "template",
    body_fields: [],
    fields_encoding: "json",
    raw_content_type: "application/json",
    raw_body: "",
    render_mode: "strict",
  });
  await callSendMock("POST", "/webhooks/rules", {
    name: "Every received email",
    endpoint_id: endpoint.id,
    events: ["email.received"],
    filter: null,
    is_enabled: true,
  });
  const { secret } = await callSendMock(
    "GET",
    `/webhooks/endpoints/${endpoint.id}/secret`,
  );

  return secret;
}

function waitForDelivery(firstDelivery) {
  const timeout = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("No webhook arrived")),
      deliveryTimeoutMs,
    ).unref();
  });

  return Promise.race([firstDelivery, timeout]);
}

const { receiver, receiverUrl, firstDelivery } = await startDeliveryReceiver();
const webhookSecret = await connectEndpoint(receiverUrl);
await callSendMock("POST", "/send", {
  from: "shop@example.test",
  to: ["sam@example.test"],
  subject: "Signed by SendMock",
  text: "Hello",
});
const { rawBody, headers } = await waitForDelivery(firstDelivery);
receiver.close();

const webhook = new Webhook(webhookSecret);
const verifiedEvent = webhook.verify(rawBody, headers);
if (verifiedEvent.type !== "email.received") {
  throw new Error(`Unexpected event ${verifiedEvent.type}`);
}
let isTamperedBodyRefused = false;
try {
  webhook.verify(`${rawBody} `, headers);
} catch {
  isTamperedBodyRefused = true;
}
if (!isTamperedBodyRefused) {
  throw new Error("A tampered body passed verification");
}
console.log(
  `Verified ${headers["webhook-id"]} (${verifiedEvent.type}) with standardwebhooks; a tampered body is refused.`,
);
