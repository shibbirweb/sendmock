// The official Twilio Node SDK against SendMock with a subaccount, as an app with one
// subaccount per customer works: create it with the main account, read its token with the
// account fetch, send under it, and check every status callback with that token (SM-19.8).
import { once } from "node:events";
import { createServer } from "node:http";
import twilio from "twilio";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
// The shipped Twilio provider's main account; the Accounts API checks it.
const mainAccountSid = "ACtest00000000000000000000000000";
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

async function waitForCallbacks(receivedCallbacks) {
  const deadline = Date.now() + callbackTimeoutMs;
  while (receivedCallbacks.length < expectedStatuses.length) {
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
