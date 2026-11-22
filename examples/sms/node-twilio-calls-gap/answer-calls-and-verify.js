// The official Twilio Node SDK places a call, an endpoint SendMock does not implement. An
// HTTP Catcher bin attached to the Twilio provider answers it on the same base URL, and its
// rule's follow-up webhook calls the app's StatusCallback, signed as Twilio signs it, which
// the SDK's validateRequest accepts (PL-21.7).
// AC: PL-21.7
import { once } from "node:events";
import { createServer } from "node:http";
import twilio from "twilio";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
// The shipped Twilio provider's main account, which signs its callbacks.
const mainAccountSid = "ACtest00000000000000000000000000";
const mainAuthToken = "twilio-test-token";
const callbackTimeoutMs = 30_000;

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

async function callSendmock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** Calls.json answered as Twilio does, with a signed status callback half a second later. */
async function attachCallsBin() {
  const providerBin = await callSendmock("PUT", "/api/v1/provider-bins/sms/twilio", {
    bin_name: "twilio-calls",
  });
  await callSendmock("PUT", `/api/v1/http/bins/${providerBin.bin_id}/responses`, [
    {
      id: "",
      name: "Calls",
      is_enabled: true,
      method: "POST",
      path_glob: "/2010-04-01/Accounts/*/Calls.json",
      filter: null,
      response: {
        status_code: 201,
        headers: { "content-type": "application/json" },
        body: '{"sid": "CA{{ random_hex(32) }}", "account_sid": "ACtest00000000000000000000000000", "status": "queued", "to": "{{ request.form.To }}", "from": "{{ request.form.From }}", "direction": "outbound-api"}',
      },
      delay_min_ms: 0,
      delay_max_ms: 0,
      failure_rate_percent: 0,
      failure_status_code: 503,
      follow_up: {
        url: "{{ request.form.StatusCallback }}",
        endpoint_id: null,
        template_id: "twilio.status_callback",
        delay_ms: 500,
      },
    },
  ]);
}

/** The app's status callback handler, keeping each callback's signature and fields. */
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
  const callbackUrl = `http://127.0.0.1:${callbackServer.address().port}/calls/status`;

  return { callbackServer, callbackUrl, receivedCallbacks };
}

async function waitForCallback(receivedCallbacks) {
  const deadline = Date.now() + callbackTimeoutMs;
  while (receivedCallbacks.length === 0) {
    if (Date.now() > deadline) {
      throw new Error("No status callback arrived");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return receivedCallbacks[0];
}

await attachCallsBin();
const { callbackServer, callbackUrl, receivedCallbacks } =
  await startStatusCallbackHandler();
const client = twilio(mainAccountSid, mainAuthToken, {
  httpClient: new SendMockRequestClient(),
});

const call = await client.calls.create({
  to: "+14155550100",
  from: "+15005550006",
  url: "http://demo.twilio.com/docs/voice.xml",
  statusCallback: callbackUrl,
});
if (!call.sid.startsWith("CA") || call.status !== "queued") {
  throw new Error(`Unexpected call: ${call.sid} ${call.status}`);
}
console.log(`Call ${call.sid} answered by the attached bin`);

const statusCallback = await waitForCallback(receivedCallbacks);
const isGenuine = twilio.validateRequest(
  mainAuthToken,
  statusCallback.signature,
  callbackUrl,
  statusCallback.fields,
);
callbackServer.close();
if (!isGenuine) {
  throw new Error("The status callback's X-Twilio-Signature did not validate");
}
console.log("The status callback arrived with a valid X-Twilio-Signature");
