// AC: EM-24.5
// mailgun.js sends with a stored template and with `v:` variables, as an app tags its mail with
// its own ids; then a simulated open's `mailgun.events` webhook must carry those variables and
// the message id the SDK got back, so the app can match the webhook to its send.
import { once } from "node:events";
import { createServer } from "node:http";

import Mailgun from "mailgun.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026");
const sendingDomain = "mg.example.test";
const webhookTimeoutMs = 30_000;

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

/** Keeps every webhook body posted to it. */
async function startWebhookReceiver() {
  const receivedBodies = [];
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", () => {
      receivedBodies.push(Buffer.concat(bodyChunks).toString("utf8"));
      response.writeHead(200).end();
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  return {
    receiverServer,
    receivedBodies,
    receiverUrl: `http://127.0.0.1:${receiverServer.address().port}/mailgun`,
  };
}

async function createMailgunEndpoint(receiverUrl) {
  const variables = await callSendMock("GET", "/webhooks/variables");
  const hasSigningKey = (variables.items ?? variables).some(
    (variable) => variable.name === "mailgun_signing_key",
  );
  if (!hasSigningKey) {
    await callSendMock("POST", "/webhooks/variables", {
      name: "mailgun_signing_key",
      kind: "secret",
      scope: "global",
      value: "key-sendmock-example",
      description: "Signs SendMock's Mailgun webhooks for the SDK check",
    });
  }
  return callSendMock("POST", "/webhooks/endpoints", {
    name: "Mailgun variables",
    url: receiverUrl,
    is_enabled: true,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "mailgun.events",
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
}

async function waitForWebhook(receivedBodies) {
  const deadline = Date.now() + webhookTimeoutMs;
  while (receivedBodies.length === 0) {
    if (Date.now() > deadline) {
      throw new Error("No webhook arrived");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return JSON.parse(receivedBodies[0]);
}

const stripBrackets = (messageId) => messageId.replace(/^<|>$/g, "");

await callSendMock("POST", "/emails/templates", {
  id: "order-shipped",
  subject: "Order {{ order_id }} shipped",
  text: "Hi {{ name }}, your order is on its way.",
  html: null,
});
const { receiverServer, receivedBodies, receiverUrl } = await startWebhookReceiver();
const endpoint = await createMailgunEndpoint(receiverUrl);
const mailgun = new Mailgun(FormData).client({
  username: "api",
  key: "key-sendmock-example",
  url: providerUrl.origin,
});
const sent = await mailgun.messages.create(sendingDomain, {
  from: `Shop <orders@${sendingDomain}>`,
  to: ["ana@example.test"],
  template: "order-shipped",
  "t:variables": JSON.stringify({ order_id: "A-1001", name: "Ana" }),
  "v:order-id": "A-1001",
  "h:X-Mailgun-Variables": JSON.stringify({ customer_id: 42 }),
});
const emailPage = await callSendMock("GET", "/emails?limit=1");
const emailId = emailPage.items[0].id;
const emailDetail = await callSendMock("GET", `/emails/${emailId}`);
if (stripBrackets(emailDetail.provider_message_id ?? "") !== stripBrackets(sent.id)) {
  throw new Error(`Stored ${emailDetail.provider_message_id}, the SDK got ${sent.id}`);
}
await callSendMock("POST", `/emails/${emailId}/simulate`, {
  event: "opened",
  webhook_endpoint_ids: [endpoint.id],
});
const webhook = await waitForWebhook(receivedBodies);
receiverServer.close();

const eventData = webhook["event-data"];
if (eventData["user-variables"]["order-id"] !== "A-1001") {
  throw new Error(`user-variables: ${JSON.stringify(eventData["user-variables"])}`);
}
if (eventData["user-variables"].customer_id !== 42) {
  throw new Error(`user-variables: ${JSON.stringify(eventData["user-variables"])}`);
}
if (eventData.message.headers["message-id"] !== stripBrackets(sent.id)) {
  throw new Error(`message-id ${eventData.message.headers["message-id"]}, sent ${sent.id}`);
}
console.log(`Template send ${sent.id}: its webhook carries the variables and the id`);
