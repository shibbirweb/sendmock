// The official Twilio Node SDK against SendMock with a subaccount, as an app with one
// subaccount per customer works: create it with the main account, read its token with the
// account fetch, send under it, and check every status callback with that token (SM-19.8).
// The main account cannot read the subaccount's message, and a text to the subaccount's number
// reaches the app signed with the subaccount's token (SM-22.6).
import { once } from "node:events";
import { createServer } from "node:http";
import twilio from "twilio";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const subaccountNumber = "+15550007777";
// The shipped Twilio provider's main account; the Accounts API checks it.
const mainAccountSid = "ACtest0000000000000000000000000000";
const mainAuthToken = "twilio-test-token";
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

/** A local status callback handler that keeps each callback's signature and fields. */
async function startStatusCallbackHandler() {
  const receivedCallbacks = [];
  const callbackServer = createServer((request, response) => {
    let requestBody = "";
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      receivedCallbacks.push({
        signature: request.headers["x-twilio-signature"] ?? "",
        fields: Object.fromEntries(new URLSearchParams(requestBody)),
      });
      response.writeHead(204).end();
    });
  });
  callbackServer.listen(0, "127.0.0.1");
  await once(callbackServer, "listening");
  const callbackUrl = `http://127.0.0.1:${callbackServer.address().port}/status`;

  return { callbackServer, callbackUrl, receivedCallbacks };
}

async function waitForCallbacks(
  receivedCallbacks,
  expectedCount = expectedStatuses.length,
) {
  const deadline = Date.now() + callbackTimeoutMs;
  while (receivedCallbacks.length < expectedCount) {
    if (Date.now() > deadline) {
      throw new Error(`Callbacks so far: ${receivedCallbacks.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const httpClient = new SendMockRequestClient();
const mainClient = twilio(mainAccountSid, mainAuthToken, { httpClient });

const createdSubaccount = await mainClient.api.v2010.accounts.create({
  friendlyName: "Acme Clinic",
});
const fetchedSubaccount = await mainClient.api.v2010
  .accounts(createdSubaccount.sid)
  .fetch();
if (fetchedSubaccount.authToken !== createdSubaccount.authToken) {
  throw new Error("The account fetch answered another token");
}
console.log(
  `Subaccount ${fetchedSubaccount.sid} (${fetchedSubaccount.status})`,
);

const subaccountClient = twilio(
  fetchedSubaccount.sid,
  fetchedSubaccount.authToken,
  { httpClient },
);
const { callbackServer, callbackUrl, receivedCallbacks } =
  await startStatusCallbackHandler();
const message = await subaccountClient.messages.create({
  from: "+15005550006",
  to: "+14155550110",
  body: "Your appointment is confirmed",
  statusCallback: callbackUrl,
});
if (message.accountSid !== fetchedSubaccount.sid) {
  throw new Error(`Sent under ${message.accountSid}`);
}
await waitForCallbacks(receivedCallbacks);
callbackServer.close();

for (const receivedCallback of receivedCallbacks) {
  const isSignedBySubaccount = twilio.validateRequest(
    fetchedSubaccount.authToken,
    receivedCallback.signature,
    callbackUrl,
    receivedCallback.fields,
  );
  const isSignedByMainAccount = twilio.validateRequest(
    mainAuthToken,
    receivedCallback.signature,
    callbackUrl,
    receivedCallback.fields,
  );
  if (!isSignedBySubaccount || isSignedByMainAccount) {
    throw new Error(
      `The ${receivedCallback.fields.MessageStatus} callback is not signed with the subaccount's token`,
    );
  }
}
console.log(
  `Status callbacks ${receivedCallbacks.map((callback) => callback.fields.MessageStatus).join(", ")} signed with the subaccount's token`,
);

try {
  await mainClient.messages(message.sid).fetch();
  throw new Error("The main account read the subaccount's message");
} catch (fetchError) {
  if (fetchError.status !== 404 || fetchError.code !== 20404) {
    throw fetchError;
  }
}
console.log("The main account gets 20404 for the subaccount's message");

const inboundHandler = await startStatusCallbackHandler();
await subaccountClient.incomingPhoneNumbers.create({
  phoneNumber: subaccountNumber,
  smsUrl: inboundHandler.callbackUrl,
});
const inboundResponse = await fetch(`${sendmockUrl}/api/v1/sms/inbound`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    from: "+14155550110",
    to: subaccountNumber,
    body: "See you then",
  }),
});
if (!inboundResponse.ok) {
  throw new Error(`The inbound text was refused: ${inboundResponse.status}`);
}
await waitForCallbacks(inboundHandler.receivedCallbacks, 1);
inboundHandler.callbackServer.close();
const [inboundWebhook] = inboundHandler.receivedCallbacks;
const isInboundSignedBySubaccount = twilio.validateRequest(
  fetchedSubaccount.authToken,
  inboundWebhook.signature,
  inboundHandler.callbackUrl,
  inboundWebhook.fields,
);
if (
  !isInboundSignedBySubaccount ||
  inboundWebhook.fields.AccountSid !== fetchedSubaccount.sid
) {
  throw new Error(
    `The inbound webhook is not the subaccount's: ${JSON.stringify(inboundWebhook.fields)}`,
  );
}
console.log("The inbound webhook carries and is signed with the subaccount");
