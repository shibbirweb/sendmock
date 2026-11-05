// The app's PayPal webhook route: for every event it receives it asks PayPal whether PayPal
// sent it, with `POST /v1/notifications/verify-webhook-signature` and the transmission headers,
// as PayPal's docs show, and keeps the events PayPal answered `SUCCESS` for.
import { once } from "node:events";
import { createServer } from "node:http";

async function verifyWebhookSignature(paypalApi, requestHeaders, webhookEvent, webhookId) {
  const verificationResponse = await fetch(
    `${paypalApi.providerUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${paypalApi.clientId}:${paypalApi.clientSecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: requestHeaders["paypal-auth-algo"],
        cert_url: requestHeaders["paypal-cert-url"],
        transmission_id: requestHeaders["paypal-transmission-id"],
        transmission_sig: requestHeaders["paypal-transmission-sig"],
        transmission_time: requestHeaders["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    },
  );
  const verification = await verificationResponse.json();
  return verification.verification_status === "SUCCESS";
}

export async function startPayPalWebhookReceiver(paypalApi) {
  const receiver = { receivedEvents: [], webhookId: "" };
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", async () => {
      const webhookEvent = JSON.parse(Buffer.concat(bodyChunks).toString("utf8"));
      const isFromPayPal = await verifyWebhookSignature(
        paypalApi,
        request.headers,
        webhookEvent,
        receiver.webhookId,
      ).catch(() => false);
      if (!isFromPayPal) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("verify-webhook-signature did not answer SUCCESS");
        return;
      }
      receiver.receivedEvents.push(webhookEvent);
      response.writeHead(200);
      response.end();
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  receiver.receiverServer = receiverServer;
  receiver.receiverUrl = `http://127.0.0.1:${receiverServer.address().port}/webhooks/paypal`;
  return receiver;
}
