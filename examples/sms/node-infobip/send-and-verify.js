// The official Infobip Node SDK against SendMock's provider port: an SMS with a delivery report
// to a local handler, then the message read back from SendMock's API (SM-17.1).
import { once } from "node:events";
import { createServer } from "node:http";
import { AuthType, Infobip } from "@infobip-api/sdk";

const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const recipientNumber = "41793026727";
const reportTimeoutMs = 60_000;

/** A local delivery report handler that records each report's status group. */
async function startReportHandler() {
  const receivedStatusGroups = [];
  const reportServer = createServer((request, response) => {
    let requestBody = "";
    request.on("data", (chunk) => {
      requestBody += chunk;
    });
    request.on("end", () => {
      const deliveryReport = JSON.parse(requestBody);
      receivedStatusGroups.push(
        deliveryReport.results?.[0]?.status?.groupName ?? "",
      );
      response.writeHead(204).end();
    });
  });
  reportServer.listen(0, "127.0.0.1");
  await once(reportServer, "listening");
  const reportUrl = `http://127.0.0.1:${reportServer.address().port}/reports`;

  return { reportServer, reportUrl, receivedStatusGroups };
}

async function waitForDeliveredReport(receivedStatusGroups) {
  const deadline = Date.now() + reportTimeoutMs;
  while (!receivedStatusGroups.includes("DELIVERED")) {
    if (Date.now() > deadline) {
      throw new Error(`Reports so far: ${receivedStatusGroups.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const infobip = new Infobip({
  baseUrl: providerUrl,
  apiKey: "any-api-key",
  authType: AuthType.ApiKey,
});
const { reportServer, reportUrl, receivedStatusGroups } =
  await startReportHandler();

const sendResponse = await infobip.channels.sms.send({
  type: "text",
  messages: [
    {
      destinations: [{ to: recipientNumber }],
      from: "InfoSMS",
      text: "Your code is 482913",
      notifyUrl: reportUrl,
      notifyContentType: "application/json",
    },
  ],
});
const sentMessage = sendResponse.data.messages[0];
if (sentMessage.status.groupName !== "PENDING") {
  throw new Error(`Unexpected send status: ${JSON.stringify(sentMessage)}`);
}

await waitForDeliveredReport(receivedStatusGroups);
reportServer.close();

const smsListResponse = await fetch(new URL("/api/v1/sms", sendmockUrl));
const storedSms = (await smsListResponse.json()).items.find(
  (sms) => sms.provider_id === sentMessage.messageId,
);
if (storedSms?.body !== "Your code is 482913" || storedSms.api !== "infobip") {
  throw new Error(`SendMock did not store the SMS: ${JSON.stringify(storedSms)}`);
}
console.log(
  `Infobip SDK: ${sentMessage.messageId} sent, reports ${receivedStatusGroups.join(", ")}`,
);
