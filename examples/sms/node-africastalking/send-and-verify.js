// The official Africa's Talking Node SDK against SendMock's provider port: an SMS, then the
// message read back from SendMock's API (SM-17.4).
import { createRequire } from "node:module";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";

const require = createRequire(import.meta.url);
const AfricasTalking = require("africastalking");

// The SDK has no base URL option and calls https://api.sandbox.africastalking.com through its
// own axios, so its requests are sent to the provider port, keeping their path and query.
const sdkRequire = createRequire(require.resolve("africastalking"));
sdkRequire("axios").interceptors.request.use((requestConfig) => {
  const africasTalkingUrl = new URL(requestConfig.url);
  requestConfig.url = new URL(
    `${africasTalkingUrl.pathname}${africasTalkingUrl.search}`,
    providerUrl,
  ).href;
  return requestConfig;
});

const africasTalking = AfricasTalking({
  apiKey: "any-api-key",
  username: "sandbox",
});
const sendResult = await africasTalking.SMS.send({
  to: ["+254711000111"],
  message: "Your code is 482913",
  from: "AFRICASTKNG",
});
const recipient = sendResult.SMSMessageData.Recipients[0];
if (recipient.status !== "Success" || recipient.statusCode !== 101) {
  throw new Error(`Unexpected send result: ${JSON.stringify(sendResult)}`);
}

const smsListResponse = await fetch(new URL("/api/v1/sms", sendmockUrl));
const storedSms = (await smsListResponse.json()).items.find(
  (sms) => sms.provider_id === recipient.messageId,
);
if (
  storedSms?.body !== "Your code is 482913" ||
  storedSms.api !== "africastalking"
) {
  throw new Error(`SendMock did not store the SMS: ${JSON.stringify(storedSms)}`);
}
console.log(`Africa's Talking SDK: ${recipient.messageId} sent to ${recipient.number}`);
