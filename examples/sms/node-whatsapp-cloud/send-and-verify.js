// An app calling Meta's WhatsApp Business Cloud API over HTTP, as most apps do (Meta's Node SDK
// is archived), against SendMock's provider port: a text, a template and an interactive message
// are sent and read back from SendMock's API, a message without its body gets Graph's error,
// a read receipt marks the conversation read, a document is uploaded, sent by its media id and
// downloaded again, and the app's webhook handler passes Meta's callback URL check, then
// receives a status and a reply whose X-Hub-Signature-256 it verifies (SM-18.1 to SM-18.5).
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const providerUrl = process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const phoneNumberId = "106540352242922";
const customer = "16505551234";
const appSecret = "whatsapp-app-secret";
const verifyToken = "sendmock-verify-token";
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

async function callCloudApi(requestBody) {
  const response = await fetch(`${providerUrl}/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: "Bearer whatsapp-access-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...requestBody }),
  });
  return { status: response.status, answer: await response.json() };
}

async function sendMessage(messageType, typeObject) {
  const { status, answer } = await callCloudApi({
    recipient_type: "individual",
    to: customer,
    type: messageType,
    [messageType]: typeObject,
  });
  if (status !== 200 || !answer.messages?.[0]?.id?.startsWith("wamid.")) {
    throw new Error(`The ${messageType} send answered ${status}: ${JSON.stringify(answer)}`);
  }
  return answer.messages[0];
}

async function readStoredMessage(wamid) {
  const response = await fetch(`${sendmockUrl}/api/v1/sms?api=whatsapp_cloud`);
  const storedMessage = (await response.json()).items.find(
    (message) => message.provider_id === wamid,
  );
  if (storedMessage?.channel !== "whatsapp") {
    throw new Error(`SendMock did not store ${wamid}: ${JSON.stringify(storedMessage)}`);
  }
  return storedMessage;
}

function expectEqual(actualValue, expectedValue, label) {
  if (actualValue !== expectedValue) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
  }
}

async function sendEveryKind() {
  currentStep = "text";
  const textMessage = await sendMessage("text", { body: "Your order shipped" });
  expectEqual((await readStoredMessage(textMessage.id)).body, "Your order shipped", "text body");

  currentStep = "template";
  const templateMessage = await sendMessage("template", {
    name: "order_update",
    language: { code: "en_US" },
    components: [{ type: "body", parameters: [{ type: "text", text: "1042" }] }],
  });
  expectEqual(templateMessage.message_status, "accepted", "template status");
  expectEqual(
    (await readStoredMessage(templateMessage.id)).body,
    "Template order_update (en_US)\n1042",
    "template body",
  );

  currentStep = "interactive";
  const interactiveMessage = await sendMessage("interactive", {
    type: "button",
    body: { text: "Confirm the order?" },
    action: { buttons: [{ type: "reply", reply: { id: "yes", title: "Yes" } }] },
  });
  expectEqual((await readStoredMessage(interactiveMessage.id)).body, "Confirm the order?\nYes", "interactive body");
  return textMessage;
}

async function checkRefusalAndReadReceipt(textMessage) {
  currentStep = "a text without its body";
  const refused = await callCloudApi({ to: customer, type: "text", text: {} });
  expectEqual(refused.status, 400, "refusal status");
  expectEqual(refused.answer.error?.code, 100, "Graph error code");
  expectEqual(refused.answer.error?.type, "OAuthException", "Graph error type");

  currentStep = "read receipt";
  const readReceipt = await callCloudApi({ status: "read", message_id: textMessage.id });
  expectEqual(readReceipt.answer.success, true, "read receipt");
}

async function uploadSendAndDownloadMedia() {
  currentStep = "media upload";
  const invoiceText = "%PDF-1.4 invoice 1042";
  const uploadForm = new FormData();
  uploadForm.append("messaging_product", "whatsapp");
  uploadForm.append("type", "application/pdf");
  uploadForm.append("file", new Blob([invoiceText], { type: "application/pdf" }), "invoice.pdf");
  const uploadResponse = await fetch(`${providerUrl}/v21.0/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: "Bearer whatsapp-access-token" },
    body: uploadForm,
  });
  const { id: mediaId } = await uploadResponse.json();

  currentStep = "document sent by media id";
  const documentMessage = await sendMessage("document", { id: mediaId, filename: "invoice.pdf" });
  const storedDocument = await readStoredMessage(documentMessage.id);
  expectEqual(storedDocument.media[0]?.content_type, "application/pdf", "attached file type");

  currentStep = "media lookup and download";
  const lookupResponse = await fetch(`${providerUrl}/v21.0/${mediaId}`, {
    headers: { Authorization: "Bearer whatsapp-access-token" },
  });
  const mediaDetails = await lookupResponse.json();
  expectEqual(mediaDetails.file_size, invoiceText.length, "media size");
  const downloadResponse = await fetch(mediaDetails.url, {
    headers: { Authorization: "Bearer whatsapp-access-token" },
  });
  expectEqual(await downloadResponse.text(), invoiceText, "downloaded file");
}

/** The app's webhook handler: Meta's check by GET, signed envelopes by POST. */
function startWebhookHandler(receivedChanges) {
  const webhookServer = createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET") {
      const isOurToken = requestUrl.searchParams.get("hub.verify_token") === verifyToken;
      // Meta's check expects the challenge echoed back, as plain text and never as HTML.
      response.writeHead(isOurToken ? 200 : 403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(isOurToken ? requestUrl.searchParams.get("hub.challenge") : "");
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
      const isSigned = request.headers["x-hub-signature-256"] === expectedSignature;
      receivedChanges.push({ isSigned, value: JSON.parse(body).entry[0].changes[0].value });
      response.writeHead(200);
      response.end();
    });
  });
  return new Promise((resolve) => {
    webhookServer.listen(0, "127.0.0.1", () => resolve(webhookServer));
  });
}

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  return response.json();
}

async function waitForChange(receivedChanges, isWanted, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const wantedChange = receivedChanges.find(({ value }) => isWanted(value));
    if (wantedChange !== undefined) {
      expectEqual(wantedChange.isSigned, true, `${label} signature`);
      return wantedChange.value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No ${label} reached the webhook handler`);
}

async function receiveSignedWebhooks() {
  currentStep = "callback URL setup";
  const receivedChanges = [];
  const webhookServer = await startWebhookHandler(receivedChanges);
  const callbackUrl = `http://127.0.0.1:${webhookServer.address().port}/whatsapp/webhook`;
  const cloudProvider = await callSendMock("GET", "/sms/providers/whatsapp_cloud");
  const webhookCredential = cloudProvider.credentials.find((credential) => credential.name === "webhook_url");
  webhookCredential.value = callbackUrl;
  await callSendMock("PATCH", "/sms/providers/whatsapp_cloud", cloudProvider);
  await callSendMock("PATCH", "/settings", { sms_simulation_profile: "instant" });

  currentStep = "Meta's callback URL check";
  const verification = await callSendMock("POST", "/sms/whatsapp-cloud/verify-webhook", {});
  expectEqual(verification.is_verified, true, "callback URL check");

  currentStep = "status webhook";
  const statusMessage = await sendMessage("text", { body: "Your table is ready" });
  await waitForChange(receivedChanges, (value) => value.statuses?.[0]?.id === statusMessage.id && value.statuses[0].status === "delivered", "delivered status");

  currentStep = "reply webhook";
  await callSendMock("POST", "/sms/inbound", { from: `+${customer}`, to: "+15550783881", body: "On my way", channel: "whatsapp" });
  await waitForChange(receivedChanges, (value) => value.messages?.[0]?.text?.body === "On my way", "reply");
  webhookServer.close();
}

try {
  const textMessage = await sendEveryKind();
  await checkRefusalAndReadReceipt(textMessage);
  await uploadSendAndDownloadMedia();
  await receiveSignedWebhooks();
  console.log("WhatsApp Cloud API: sends, refusal, read receipt, media and signed webhooks checked.");
} catch (stepError) {
  console.error(`Failed at ${currentStep}:`, stepError);
  process.exit(1);
}
