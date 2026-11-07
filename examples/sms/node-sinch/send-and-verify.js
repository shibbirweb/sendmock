// The official Sinch Node SDK against SendMock's provider port: an SMS batch with delivery
// reports to a local handler, then the message read back from SendMock's API (SM-17.3).
import { once } from "node:events";
import { createServer } from "node:http";
import { SinchClient } from "@sinch/sdk-core";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const reportTimeoutMs = 60_000;

/** A local delivery report handler that records each report's status. */
async function startReportHandler() {
  const receivedStatuses = [];
  const reportServer = createServer((request, response) => {
    let requestBody = "";
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      receivedStatuses.push(JSON.parse(requestBody).status ?? "");
      response.writeHead(204).end();
    });
  });
  reportServer.listen(0, "127.0.0.1");
  await once(reportServer, "listening");
  const reportUrl = `http://127.0.0.1:${reportServer.address().port}/sinch`;

  return { reportServer, reportUrl, receivedStatuses };
}

async function waitForDeliveredReport(receivedStatuses) {
  const deadline = Date.now() + reportTimeoutMs;
  while (!receivedStatuses.includes("Delivered")) {
    if (Date.now() > deadline) {
      throw new Error(`Reports so far: ${receivedStatuses.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// With a service plan ID and API token the SDK calls the SMS API with a Bearer token, no OAuth.
const sinchClient = new SinchClient({
  servicePlanId: "test-service-plan",
  apiToken: "any-api-token",
});
sinchClient.sms.setHostname(providerUrl);
const { reportServer, reportUrl, receivedStatuses } =
  await startReportHandler();

const sentBatch = await sinchClient.sms.batches.send({
  sendSMSRequestBody: {
    from: "+15550001111",
    to: ["+14155550100"],
    body: "Your code is 482913",
    delivery_report: "per_recipient",
    callback_url: reportUrl,
  },
});
if (sentBatch.type !== "mt_text") {
  throw new Error(`Unexpected batch: ${JSON.stringify(sentBatch)}`);
}

await waitForDeliveredReport(receivedStatuses);
reportServer.close();

const smsListResponse = await fetch(new URL("/api/v1/sms", sendmockUrl));
const storedSms = (await smsListResponse.json()).items.find(
  (sms) => sms.provider_id === sentBatch.id,
);
if (storedSms?.body !== "Your code is 482913" || storedSms.api !== "sinch") {
  throw new Error(`SendMock did not store the SMS: ${JSON.stringify(storedSms)}`);
}
console.log(`Sinch SDK: batch ${sentBatch.id} sent, reports ${receivedStatuses.join(", ")}`);
