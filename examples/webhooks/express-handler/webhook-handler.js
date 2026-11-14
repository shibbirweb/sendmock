// An Express handler for SendMock's native webhooks, as an app would write it: it checks the
// Standard Webhooks signature (https://www.standardwebhooks.com) with the endpoint's secret
// and keeps what it accepted. `isBroken` makes it answer 500, as a handler with a bug would.
import { createHmac, timingSafeEqual } from "node:crypto";
import express from "express";

/** Signatures older than this are refused, as the Standard Webhooks libraries do. */
const toleranceSeconds = 5 * 60;

/** The `v1,` signatures of `id.timestamp.body` with the base64 key after `whsec_`. */
export function isSignedBySecret(webhookSecret, headers, rawBody) {
  const webhookId = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"] ?? "";
  if (webhookId === undefined || timestamp === undefined) {
    return false;
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!(ageSeconds <= toleranceSeconds)) {
    return false;
  }
  const signingKey = Buffer.from(webhookSecret.replace(/^whsec_/, ""), "base64");
  const expectedSignature = createHmac("sha256", signingKey)
    .update(`${webhookId}.${timestamp}.${rawBody}`)
    .digest();

  return signatureHeader.split(" ").some((versionedSignature) => {
    const [version, signature] = versionedSignature.split(",");
    const givenSignature = Buffer.from(signature ?? "", "base64");
    return (
      version === "v1" &&
      givenSignature.length === expectedSignature.length &&
      timingSafeEqual(givenSignature, expectedSignature)
    );
  });
}

/** The app: `POST /webhooks/mail` takes `email.received` deliveries. */
export function buildWebhookApp(webhookSecret) {
  const handlerState = { isBroken: false, acceptedEvents: [] };
  const webhookApp = express();
  webhookApp.post(
    "/webhooks/mail",
    express.text({ type: "*/*" }),
    (request, response) => {
      if (handlerState.isBroken) {
        response.status(500).json({ error: "the handler has a bug" });
        return;
      }
      if (!isSignedBySecret(webhookSecret(), request.headers, request.body)) {
        response.status(401).json({ error: "bad signature" });
        return;
      }
      handlerState.acceptedEvents.push(JSON.parse(request.body));
      response.status(200).json({ ok: true });
    },
  );

  return { webhookApp, handlerState };
}
