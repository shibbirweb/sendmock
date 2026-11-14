// The AWS SDK's SNS client against SendMock's provider port: a Publish to a phone number, then
// the message read back from SendMock's API (SM-17.5).
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";

const snsClient = new SNSClient({
  region: "us-east-1",
  endpoint: providerUrl,
  credentials: { accessKeyId: "AKIAANY", secretAccessKey: "any-secret" },
});

const { MessageId: messageId } = await snsClient.send(
  new PublishCommand({
    PhoneNumber: "+14155550100",
    Message: "Your code is 482913",
  }),
);
if (!messageId) {
  throw new Error("SNS answered no MessageId");
}

const smsListResponse = await fetch(new URL("/api/v1/sms", sendmockUrl));
const storedSms = (await smsListResponse.json()).items.find(
  (sms) => sms.provider_id === messageId,
);
if (storedSms?.body !== "Your code is 482913" || storedSms.api !== "sns") {
  throw new Error(`SendMock did not store the SMS: ${JSON.stringify(storedSms)}`);
}
console.log(`SNS client: ${messageId} published to ${storedSms.to_number}`);
