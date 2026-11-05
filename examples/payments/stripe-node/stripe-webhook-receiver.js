// The app's Stripe webhook route: it reads the raw body, checks `Stripe-Signature` with the
// official SDK's `constructEvent`, as Stripe's docs show, and keeps every event it accepted
// with the exact bytes it received, so the PHP and Python SDKs can check the same deliveries.
import { createServer } from "node:http";
import { once } from "node:events";

export async function startStripeWebhookReceiver(stripe, webhookSecret) {
  const receivedEvents = [];
  const receivedDeliveries = [];
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", () => {
      const rawBody = Buffer.concat(bodyChunks).toString("utf8");
      const signature = request.headers["stripe-signature"] ?? "";
      try {
        const stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        receivedEvents.push(stripeEvent);
        receivedDeliveries.push({ payload: rawBody, signature });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ received: true }));
      } catch (verificationError) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end(`Webhook Error: ${verificationError.message}`);
      }
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  return {
    receiverServer,
    receivedEvents,
    receivedDeliveries,
    receiverUrl: `http://127.0.0.1:${receiverServer.address().port}/webhooks/stripe`,
  };
}
