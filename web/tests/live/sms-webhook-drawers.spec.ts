import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

/** Nothing listens on port 9, so calls are refused at once: Twilio's 11205. */
const unreachableBaseUrl = "http://127.0.0.1:9";
const threadList = "section[aria-label='Conversation list']";

/** An app on a free local port that answers every reply webhook with this TwiML. */
async function startTwimlApp(twiml: string) {
  const receivedHeaders: IncomingHttpHeaders[] = [];
  const twimlApp = createServer((appRequest, appResponse) => {
    receivedHeaders.push(appRequest.headers);
    appRequest.resume();
    appRequest.on("end", () => {
      appResponse.writeHead(200, { "Content-Type": "text/xml" });
      appResponse.end(twiml);
    });
  });
  await new Promise<void>((resolve) => {
    twimlApp.listen(0, "127.0.0.1", resolve);
  });
  const { port } = twimlApp.address() as AddressInfo;

  return {
    inboundUrl: `http://127.0.0.1:${port}/sms/inbound`,
    receivedHeaders,
    close: () =>
      new Promise<void>((resolve) => {
        twimlApp.close(() => resolve());
      }),
  };
}

async function registerNumber(
  request: APIRequestContext,
  appNumber: string,
  inboundUrl: string,
) {
  const numberResponse = await request.post("/api/v1/numbers", {
    data: {
      number: appNumber,
      label: "Live replies",
      channels: ["sms"],
      inbound_url: inboundUrl,
      inbound_method: "POST",
      inbound_fallback_url: null,
      inbound_template_id: null,
      status_callback_url: null,
      messaging_service_sid: null,
    },
  });
  expect(numberResponse.status()).toBe(201);
}

async function receiveInboundText(
  page: Page,
  request: APIRequestContext,
  message: { from: string; to: string },
) {
  await page.goto("/sms");
  const inboundResponse = await request.post("/api/v1/sms/inbound", {
    data: { ...message, body: "Is it ready?" },
  });
  expect(inboundResponse.status()).toBe(201);
  await page.locator(threadList).getByText(message.from).click();
}

async function openMessageDrawer(page: Page, contactNumber: string) {
  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();

  return page.getByRole("dialog", { name: "Message details" });
}

test("SM-08.3 the message drawer lists each status callback attempt on the live binary", async ({
  page,
  request,
}) => {
  const contactNumber = "+14155550188";
  const sendResponse = await request.post("/api/v1/sms", {
    data: {
      from: "+15550001111",
      to: contactNumber,
      body: "Your order shipped",
      status_callback: `${unreachableBaseUrl}/sms/status`,
    },
  });
  expect(sendResponse.status()).toBe(201);
  const failedApiCalls = watchFailedApiCalls(page);

  const messageDrawer = await openMessageDrawer(page, contactNumber);
  await messageDrawer.getByRole("tab", { name: /Callbacks/ }).click();

  await expect(
    messageDrawer.getByRole("list", { name: "Callback attempts" }),
  ).toContainText("Attempt 1");
  expect(failedApiCalls).toEqual([]);
});

test("SM-09.7 an inbound bubble shows a failed reply webhook live, and the drawer resends it", async ({
  page,
  request,
}) => {
  const appNumber = "+15550006666";
  const contactNumber = "+447700900999";
  await registerNumber(request, appNumber, `${unreachableBaseUrl}/sms/inbound`);
  const failedApiCalls = watchFailedApiCalls(page);

  await receiveInboundText(page, request, {
    from: contactNumber,
    to: appNumber,
  });
  const replyWebhookResult = page.getByTestId("reply-webhook-result").first();
  await expect(replyWebhookResult).toHaveText(
    "Reply webhook failed: 11205 HTTP connection failure",
  );

  await replyWebhookResult.click();
  const panel = page
    .getByRole("dialog", { name: "Message details" })
    .getByTestId("reply-webhook-panel");
  const attempts = panel.getByRole("list", { name: "Reply webhook attempts" });
  await expect(attempts.getByRole("listitem")).toHaveCount(1);
  await expect(attempts).toContainText("Primary URL");
  await expect(attempts).toContainText(/x-twilio-signature/i);
  await panel.getByRole("button", { name: "Resend reply webhook" }).click();
  await expect(attempts.getByRole("listitem")).toHaveCount(2);
  expect(failedApiCalls).toEqual([]);
});

test("SM-09.2 SM-09.3 SM-09.7 a TwiML answer from a running app becomes a reply with its badge", async ({
  page,
  request,
}) => {
  const appNumber = "+15550007777";
  const contactNumber = "+447700900888";
  const twimlApp = await startTwimlApp(
    "<Response><Message>Yes, it is ready</Message></Response>",
  );
  await registerNumber(request, appNumber, twimlApp.inboundUrl);
  const failedApiCalls = watchFailedApiCalls(page);

  try {
    await receiveInboundText(page, request, {
      from: contactNumber,
      to: appNumber,
    });

    await expect(page.getByTestId("reply-webhook-result").first()).toHaveText(
      "Reply webhook 200, 1 TwiML reply",
    );
    await expect(
      page.getByRole("button", { name: "TwiML reply" }).first(),
    ).toBeVisible();
    await expect(
      page
        .locator("[data-sms-direction='outbound']")
        .filter({ hasText: "Yes, it is ready" }),
    ).toBeVisible();
    expect(twimlApp.receivedHeaders[0]?.["x-twilio-signature"]).toBeTruthy();
    expect(failedApiCalls).toEqual([]);
  } finally {
    await twimlApp.close();
  }
});
