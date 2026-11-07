// The official Telnyx Node SDK against SendMock's provider port: an SMS with status webhooks to a
// local handler, then the message read back from SendMock's API (SM-17.2). A second client sends
// under the `/projects/shop/` prefix, and the message is found in that project (PL-10.4).
import { once } from "node:events";
import { createServer } from "node:http";
import Telnyx from "telnyx";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const webhookTimeoutMs = 60_000;

/** A local webhook handler that records each event type and recipient status. */
async function startWebhookHandler() {
  const receivedEvents = [];
  const webhookServer = createServer((request, response) => {
    let requestBody = "";
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      const telnyxEvent = JSON.parse(requestBody).data;
      receivedEvents.push(
        `${telnyxEvent.event_type}:${telnyxEvent.payload.to[0].status}`,
      );
      response.writeHead(204).end();
    });
  });
  webhookServer.listen(0, "127.0.0.1");
  await once(webhookServer, "listening");
  const webhookUrl = `http://127.0.0.1:${webhookServer.address().port}/telnyx`;

  return { webhookServer, webhookUrl, receivedEvents };
}

async function waitForFinalizedEvent(receivedEvents) {
  const deadline = Date.now() + webhookTimeoutMs;
  while (!receivedEvents.includes("message.finalized:delivered")) {
    if (Date.now() > deadline) {
      throw new Error(`Webhooks so far: ${receivedEvents.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const client = new Telnyx({
  apiKey: "KEY_any",
  baseURL: `${providerUrl}/v2`,
});
const { webhookServer, webhookUrl, receivedEvents } =
  await startWebhookHandler();

const { data: sentMessage } = await client.messages.send({
  from: "+15550001111",
  to: "+14155550100",
  text: "Your code is 482913",
  webhook_url: webhookUrl,
});
if (sentMessage.to[0].status !== "queued") {
  throw new Error(`Unexpected send status: ${JSON.stringify(sentMessage)}`);
}

await waitForFinalizedEvent(receivedEvents);
webhookServer.close();

const smsListResponse = await fetch(new URL("/api/v1/sms", sendmockUrl));
const storedSms = (await smsListResponse.json()).items.find(
  (sms) => sms.provider_id === sentMessage.id,
);
if (storedSms?.body !== "Your code is 482913" || storedSms.api !== "telnyx") {
  throw new Error(
    `SendMock did not store the SMS: ${JSON.stringify(storedSms)}`,
  );
}
console.log(
  `Telnyx SDK: ${sentMessage.id} sent, webhooks ${receivedEvents.join(", ")}`,
);

/** A project for the second send; it may exist from an earlier run. */
async function createShopProject() {
  const projectResponse = await fetch(
    new URL("/api/v1/projects", sendmockUrl),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "shop", name: "Shop" }),
    },
  );
  if (projectResponse.status !== 201 && projectResponse.status !== 409) {
    throw new Error(`Could not create the project: ${projectResponse.status}`);
  }
}

await createShopProject();
const shopClient = new Telnyx({
  apiKey: "KEY_any",
  baseURL: `${providerUrl}/projects/shop/v2`,
});
const { data: shopMessage } = await shopClient.messages.send({
  from: "+15550001111",
  to: "+14155550101",
  text: "Your shop code is 731904",
});
const shopListResponse = await fetch(
  new URL("/api/v1/sms?project=shop", sendmockUrl),
);
const shopSms = (await shopListResponse.json()).items.find(
  (sms) => sms.provider_id === shopMessage.id,
);
if (
  shopSms?.project !== "shop" ||
  shopSms.body !== "Your shop code is 731904"
) {
  throw new Error(
    `SendMock did not store the SMS in shop: ${JSON.stringify(shopSms)}`,
  );
}
console.log(
  `Telnyx SDK under /projects/shop/: ${shopMessage.id} stored in shop`,
);
