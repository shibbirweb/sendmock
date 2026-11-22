// The official Twilio Node SDK against SendMock: an SMS with status callbacks to a local
// handler, then a Verify login with the code read from SendMock's API (SM-02.4, VF-03.4).
import { once } from "node:events";
import { createServer } from "node:http";
import twilio from "twilio";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const recipientNumber = "+14155550100";
const expectedStatuses = ["queued", "sent", "delivered"];
const callbackTimeoutMs = 60_000;

/** Sends every Twilio request to SendMock's provider port, keeping its path and query. */
class SendMockRequestClient extends twilio.RequestClient {
  request(requestOptions) {
    const twilioUrl = new URL(requestOptions.uri);
    const sendmockRequestUrl = new URL(
      `${twilioUrl.pathname}${twilioUrl.search}`,
      providerUrl,
    );

    return super.request({ ...requestOptions, uri: sendmockRequestUrl.href });
  }
}

/** A local status callback handler that records each `MessageStatus` it receives. */
async function startStatusCallbackHandler() {
  const receivedStatuses = [];
  const callbackServer = createServer((request, response) => {
    let requestBody = "";
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      receivedStatuses.push(
        new URLSearchParams(requestBody).get("MessageStatus") ?? "",
      );
      response.writeHead(204).end();
    });
  });
  callbackServer.listen(0, "127.0.0.1");
  await once(callbackServer, "listening");
  const callbackUrl = `http://127.0.0.1:${callbackServer.address().port}/status`;

  return { callbackServer, callbackUrl, receivedStatuses };
}

async function waitForStatuses(receivedStatuses) {
  const deadline = Date.now() + callbackTimeoutMs;
  while (receivedStatuses.length < expectedStatuses.length) {
    if (Date.now() > deadline) {
      throw new Error(`Callbacks so far: ${receivedStatuses.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (receivedStatuses.join(",") !== expectedStatuses.join(",")) {
    throw new Error(`Callbacks out of order: ${receivedStatuses.join(", ")}`);
  }
}

async function readVerifyCode(phoneNumber) {
  const otpUrl = new URL("/api/v1/otp", sendmockUrl);
  otpUrl.searchParams.set("to", phoneNumber);
  otpUrl.searchParams.set("channel", "verify");
  const otpResponse = await fetch(otpUrl);
  if (!otpResponse.ok) {
    throw new Error(`No Verify code for ${phoneNumber}: ${otpResponse.status}`);
  }

  return (await otpResponse.json()).code;
}

const client = twilio("AC00000000000000000000000000000001", "any-auth-token", {
  httpClient: new SendMockRequestClient(),
});

const { callbackServer, callbackUrl, receivedStatuses } =
  await startStatusCallbackHandler();
const message = await client.messages.create({
  from: "+15005550006",
  to: recipientNumber,
  body: "Your order has shipped",
  statusCallback: callbackUrl,
});
console.log(`Sent ${message.sid} (${message.status})`);
await waitForStatuses(receivedStatuses);
console.log(`Status callbacks: ${receivedStatuses.join(", ")}`);
callbackServer.close();

const verifyService = await client.verify.v2.services.create({
  friendlyName: "Node shop",
});
const verification = await client.verify.v2
  .services(verifyService.sid)
  .verifications.create({ to: recipientNumber, channel: "sms" });
const verifyCode = await readVerifyCode(recipientNumber);
const verificationCheck = await client.verify.v2
  .services(verifyService.sid)
  .verificationChecks.create({ to: recipientNumber, code: verifyCode });
if (verificationCheck.status !== "approved") {
  throw new Error(`Verify login ended ${verificationCheck.status}`);
}
console.log(`Verify login ${verification.sid} approved with ${verifyCode}`);

/** The recipient texts the app's number, as a reply would arrive (SM-23.4). */
async function textAppNumber(body) {
  const inboundResponse = await fetch(new URL("/api/v1/sms/inbound", sendmockUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from: recipientNumber, to: "+15005550006", body }),
  });
  if (!inboundResponse.ok) {
    throw new Error(`The ${body} text was refused: ${inboundResponse.status}`);
  }
}

await textAppNumber("STOP");
try {
  await client.messages.create({
    from: "+15005550006",
    to: recipientNumber,
    body: "Sent after STOP",
  });
  throw new Error("A send after STOP was accepted");
} catch (sendError) {
  if (sendError.code !== 21610) {
    throw sendError;
  }
}
await textAppNumber("START");
const resumedMessage = await client.messages.create({
  from: "+15005550006",
  to: recipientNumber,
  body: "Sent after START",
});
console.log(`STOP gave 21610, and after START ${resumedMessage.sid} was sent`);
