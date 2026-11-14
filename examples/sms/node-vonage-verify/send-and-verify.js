// The Vonage Node SDK's Verify2 client against SendMock's provider port: a login that starts an
// SMS verification, reads the code from SendMock's API and checks it, then a cancelled one
// (VF-05.4).
import { generateKeyPairSync } from "node:crypto";
import { Verify2 } from "@vonage/verify2";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";

// The SDK signs a JWT for every call, so it needs a real key; SendMock does not check it.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const verifyClient = new Verify2(
  { applicationId: "sendmock-example-app", privateKey },
  { apiHost: providerUrl },
);

const startLogin = () =>
  verifyClient.newRequest({
    brand: "Shop",
    workflow: [{ channel: "sms", to: "447700900001" }],
  });

const { requestId } = await startLogin();
const verificationResponse = await fetch(
  new URL(`/api/v1/verify/${requestId}`, sendmockUrl),
);
const verification = await verificationResponse.json();
if (verification.status !== "pending" || !verification.code) {
  throw new Error(`SendMock has no pending code: ${JSON.stringify(verification)}`);
}

const checkStatus = await verifyClient.checkCode(requestId, verification.code);
if (checkStatus !== "completed") {
  throw new Error(`Vonage Verify answered ${checkStatus}, not completed`);
}

const { requestId: cancelledRequestId } = await startLogin();
const isCancelled = await verifyClient.cancel(cancelledRequestId);
if (!isCancelled) {
  throw new Error("Vonage Verify did not cancel the second request");
}
console.log(
  `Vonage Verify2 client: ${requestId} completed, ${cancelledRequestId} cancelled`,
);
