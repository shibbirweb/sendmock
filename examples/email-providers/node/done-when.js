// AC: EM-08.5 WH-06.2
// Each email provider's official Node SDK sends to a running SendMock, pointed at the provider
// port by the SDK's own base URL setting, as the recipes in the docs show; then the app reads
// every message back through SendMock's API and checks a refused send gets the provider's error.
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { BrevoClient } from "@getbrevo/brevo";
import sendgridClient from "@sendgrid/client";
import sendgridMail from "@sendgrid/mail";
import Mailgun from "mailgun.js";
import { ServerClient } from "postmark";
import { Resend } from "resend";

import {
  routeProviderWebhooks,
  signedProviders,
  startSignatureReceiver,
} from "./webhook-signature-checks.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026");
const recipient = "sam@example.test";
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${answerText}`);
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

/** Marks each signed provider's email delivered and waits for its verified webhook. */
async function checkWebhookSignatures(verifiedProviders) {
  for (const providerKey of signedProviders) {
    currentStep = `${providerKey} webhook signature`;
    const [providerEmail] = await readEmailsFrom(providerKey);
    await callSendMock("POST", `/emails/${providerEmail.id}/simulate`, { event: "delivered" });
    const deadline = Date.now() + 30_000;
    while (!verifiedProviders.has(providerKey)) {
      if (Date.now() > deadline) {
        throw new Error(`No ${providerKey} webhook arrived`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (verifiedProviders.get(providerKey) !== true) {
      throw new Error(`The ${providerKey} webhook signature did not verify`);
    }
  }
}

async function readEmailsFrom(source) {
  const response = await fetch(`${sendmockUrl}/api/v1/emails?limit=50`);
  const emails = await response.json();
  return (emails.items ?? []).filter((email) => email.source === source);
}

async function expectStored(source, subject) {
  const storedEmails = await readEmailsFrom(source);
  if (!storedEmails.some((email) => email.subject === subject)) {
    const storedSubjects = storedEmails.map((email) => email.subject);
    throw new Error(`No ${source} email "${subject}"; found ${JSON.stringify(storedSubjects)}`);
  }
}

async function sendWithSendgrid() {
  currentStep = "SendGrid";
  sendgridMail.setClient(sendgridClient);
  sendgridMail.setApiKey("SG.sendmock-example");
  // setApiKey puts SendGrid's own host back, so the base URL is set after the key.
  sendgridClient.setDefaultRequest("baseUrl", providerUrl.origin);
  const [response] = await sendgridMail.send({
    to: recipient,
    from: "shop@example.test",
    subject: "SendGrid SDK",
    text: "Sent with @sendgrid/mail",
  });
  if (response.statusCode !== 202 || !response.headers["x-message-id"]) {
    throw new Error(`SendGrid answered ${response.statusCode}`);
  }
  await expectStored("sendgrid", "SendGrid SDK");
}

async function sendWithMailgun() {
  currentStep = "Mailgun";
  const mailgun = new Mailgun(FormData).client({
    username: "api",
    key: "key-sendmock-example",
    url: providerUrl.origin,
  });
  const result = await mailgun.messages.create("mg.example.test", {
    from: "Shop <shop@mg.example.test>",
    to: [recipient],
    subject: "Mailgun SDK",
    text: "Sent with mailgun.js",
    "o:tag": ["welcome"],
  });
  if (!result.id) {
    throw new Error(`Mailgun answered ${JSON.stringify(result)}`);
  }
  await expectStored("mailgun", "Mailgun SDK");
}

async function sendWithPostmark() {
  currentStep = "Postmark";
  const postmark = new ServerClient("postmark-sendmock-example", {
    useHttps: providerUrl.protocol === "https:",
    requestHost: providerUrl.host,
  });
  const result = await postmark.sendEmail({
    From: "shop@example.test",
    To: recipient,
    Subject: "Postmark SDK",
    TextBody: "Sent with postmark",
  });
  if (result.ErrorCode !== 0) {
    throw new Error(`Postmark answered ${JSON.stringify(result)}`);
  }
  await expectStored("postmark", "Postmark SDK");
}

async function sendWithResend() {
  currentStep = "Resend";
  const resend = new Resend("re_sendmock_example", { baseUrl: providerUrl.origin });
  const { data, error } = await resend.emails.send({
    from: "shop@example.test",
    to: [recipient],
    subject: "Resend SDK",
    html: "<p>Sent with resend</p>",
  });
  if (error || !data?.id) {
    throw new Error(`Resend answered ${JSON.stringify(error)}`);
  }
  await expectStored("resend", "Resend SDK");

  currentStep = "Resend refusing a send without a subject";
  const refused = await resend.emails.send({
    from: "shop@example.test",
    to: [recipient],
    html: "<p>No subject</p>",
  });
  if (!refused.error) {
    throw new Error("Resend accepted a send without a subject");
  }
}

async function sendWithSes() {
  currentStep = "SES v2";
  const ses = new SESv2Client({
    region: "us-east-1",
    endpoint: providerUrl.origin,
    credentials: { accessKeyId: "AKIASENDMOCKEXAMPLE", secretAccessKey: "sendmock-example" },
  });
  const result = await ses.send(
    new SendEmailCommand({
      FromEmailAddress: "shop@example.test",
      Destination: { ToAddresses: [recipient] },
      Content: {
        Simple: {
          Subject: { Data: "SES SDK" },
          Body: { Text: { Data: "Sent with @aws-sdk/client-sesv2" } },
        },
      },
    }),
  );
  if (!result.MessageId) {
    throw new Error("SES answered no MessageId");
  }
  await expectStored("ses", "SES SDK");
}

async function sendWithBrevo() {
  currentStep = "Brevo";
  const brevo = new BrevoClient({
    apiKey: "xkeysib-sendmock-example",
    baseUrl: `${providerUrl.origin}/v3`,
  });
  const result = await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: "Shop", email: "shop@example.test" },
    to: [{ email: recipient }],
    subject: "Brevo SDK",
    textContent: "Sent with @getbrevo/brevo",
  });
  if (!result.messageId) {
    throw new Error(`Brevo answered ${JSON.stringify(result)}`);
  }
  await expectStored("brevo", "Brevo SDK");
}

async function main() {
  const receiver = await startSignatureReceiver();
  await routeProviderWebhooks(callSendMock, receiver.receiverOrigin);
  await sendWithSendgrid();
  await sendWithMailgun();
  await sendWithPostmark();
  await sendWithResend();
  await sendWithSes();
  await sendWithBrevo();
  await checkWebhookSignatures(receiver.verifiedProviders);
  receiver.receiverServer.close();
  console.log("Done: SendGrid, Mailgun, Postmark, Resend, SES v2 and Brevo SDKs sent to SendMock.");
}

/** The provider requests SendMock logged last: provider, method, path, status and answer. */
async function describeLoggedRequests() {
  const response = await fetch(`${sendmockUrl}/api/v1/logs/http?limit=3`).catch(() => null);
  const loggedRequests = response?.ok ? await response.json() : { items: [] };
  return (loggedRequests.items ?? [])
    .map((loggedRequest) => {
      const headerNames = Object.keys(loggedRequest.request_headers ?? {}).join(",");
      const answer = String(loggedRequest.response_body ?? "").slice(0, 200);
      return `${loggedRequest.api} ${loggedRequest.method} ${loggedRequest.path} ${loggedRequest.response_status} [${headerNames}] ${answer}`;
    })
    .join("; ");
}

main().catch(async (error) => {
  console.error(error);
  // CI job logs need a token to read; an annotation shows the reason on the run itself.
  const reason = [
    `step: ${currentStep}`,
    error.message,
    error.code,
    JSON.stringify(error.response?.body ?? null),
    `logged: ${await describeLoggedRequests()}`,
  ]
    .filter(Boolean)
    .join(" | ");
  console.log(`::error title=Email provider SDKs::${reason.replace(/\r?\n/g, " ")}`);
  process.exit(1);
});
