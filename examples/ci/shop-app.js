// A small shop app for SendMock's CI example: it accepts SendMock's Standard Webhooks (and
// checks their signature), and on POST /orders it sends its own signed `order.paid` webhook to
// SHOP_WEBHOOK_TARGET. With SHOP_BROKEN=1 it answers webhooks with 500 and signs badly, so the
// CI run fails with exit code 5.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.SHOP_PORT ?? "8000");
const sendmockSecret = process.env.SHOP_WEBHOOK_SECRET ?? "";
const outgoingSecret = process.env.SHOP_OUTGOING_SECRET ?? "";
const webhookTarget = process.env.SHOP_WEBHOOK_TARGET ?? "";
const isBroken = process.env.SHOP_BROKEN === "1";

/** Standard Webhooks: HMAC-SHA256 of `{id}.{timestamp}.{body}` with the secret's key. */
function signStandardWebhook(secret, webhookId, timestamp, body) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", key)
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${digest}`;
}

function isGenuineWebhook(headers, body) {
  const expected = signStandardWebhook(
    sendmockSecret,
    headers["webhook-id"] ?? "",
    headers["webhook-timestamp"] ?? "",
    body,
  );
  return (headers["webhook-signature"] ?? "")
    .split(" ")
    .some(
      (signature) =>
        signature.length === expected.length &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
    );
}

async function sendOrderPaid() {
  const body = JSON.stringify({ type: "order.paid", data: { order_id: "ord_1", amount: 4200 } });
  const webhookId = `msg_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signingSecret = isBroken ? "whsec_YnJva2VuLWtleQ==" : outgoingSecret;
  await fetch(webhookTarget, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signStandardWebhook(signingSecret, webhookId, timestamp, body),
    },
    body,
  });
}

createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", async () => {
    if (request.method === "POST" && request.url === "/webhooks/sendmock") {
      const isAccepted = !isBroken && isGenuineWebhook(request.headers, body);
      response.writeHead(isAccepted ? 200 : 500).end(isAccepted ? "ok" : "rejected");
      return;
    }
    if (request.method === "POST" && request.url === "/orders") {
      await sendOrderPaid();
      response.writeHead(201, { "content-type": "application/json" }).end('{"order_id":"ord_1"}');
      return;
    }
    response.writeHead(404).end();
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Shop app on http://127.0.0.1:${port}`);
});
