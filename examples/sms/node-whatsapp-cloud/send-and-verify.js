// An app calling Meta's WhatsApp Business Cloud API over HTTP, as most apps do (Meta's Node SDK
// is archived), against SendMock's provider port: a text, a template and an interactive message
// are sent and read back from SendMock's API, a message without its body gets Graph's error,
// a read receipt marks the conversation read, and a document is uploaded, sent by its media id
// and downloaded again (SM-18.1, SM-18.2, SM-18.3, SM-18.5).
const providerUrl = process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const phoneNumberId = "106540352242922";
const customer = "16505551234";
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

try {
  const textMessage = await sendEveryKind();
  await checkRefusalAndReadReceipt(textMessage);
  await uploadSendAndDownloadMedia();
  console.log("WhatsApp Cloud API: every kind sent, refusal, read receipt and media checked.");
} catch (stepError) {
  console.error(`Failed at ${currentStep}:`, stepError);
  process.exit(1);
}
