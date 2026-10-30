import { expect, test, type APIRequestContext } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

const threadList = "section[aria-label='Conversation list']";
const conversation = "section[aria-label='Conversation']";
const appNumber = "+15550001111";

async function sendLiveSms(
  request: APIRequestContext,
  contactNumber: string,
  body: string,
) {
  const sendResponse = await request.post("/api/v1/sms", {
    data: {
      from: appNumber,
      to: contactNumber,
      body,
    },
  });
  expect(sendResponse.status()).toBe(201);

  return (await sendResponse.json()) as { id: string };
}

test("SM-06.3 a sent SMS shows its segment count and encoding on the live binary", async ({
  page,
  request,
}) => {
  const contactNumber = "+8801711111111";
  await sendLiveSms(request, contactNumber, "Ваш код 482913");
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.locator(conversation).getByText("1 segment, UCS-2"),
  ).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});

test("SM-09.1 the composer adds an inbound reply and fires sms.inbound on the live binary", async ({
  page,
  request,
}) => {
  const contactNumber = "+447700900123";
  await sendLiveSms(
    request,
    contactNumber,
    "Your table is booked for Thursday",
  );
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  const composer = page.getByLabel(`Reply as ${contactNumber}`);
  await composer.fill("Can I change it to Friday?");
  await composer.press("Enter");

  await expect(
    page
      .locator(conversation)
      .locator("[data-sms-direction='inbound']")
      .filter({ hasText: "Can I change it to Friday?" }),
  ).toBeVisible();
  const recentEvents = (await (
    await request.get("/api/v1/events/recent?type=sms.inbound")
  ).json()) as { type: string }[];
  expect(recentEvents.map((recentEvent) => recentEvent.type)).toContain(
    "sms.inbound",
  );
  expect(failedApiCalls).toEqual([]);
});

test("UI-12.2 the message drawer opens with its status history and no failing calls", async ({
  page,
  request,
}) => {
  const contactNumber = "+14155550123";
  await sendLiveSms(request, contactNumber, "Your parcel is on its way");
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();
  const messageDrawer = page.getByRole("dialog", { name: "Message details" });
  await page.waitForLoadState("networkidle");

  await expect(
    messageDrawer
      .getByRole("list", { name: "Status history" })
      .getByRole("listitem")
      .first(),
  ).toContainText("Queued");
  expect(failedApiCalls).toEqual([]);
});

test("VF-04.3 VF-04.4 a live verification is listed and its drawer opens the SMS with the code", async ({
  page,
  request,
}) => {
  const recipient = "+8801700000000";
  const serviceResponse = await request.post("/api/v1/verify/services", {
    data: {
      friendly_name: "Live shop",
      code_length: 6,
      fixed_code: "482913",
      ttl_seconds: 600,
    },
  });
  expect(serviceResponse.status()).toBe(201);
  const sampleResponse = await request.post("/api/v1/samples/verification", {
    data: {
      to: recipient,
    },
  });
  expect(sampleResponse.status()).toBe(201);
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/sms/verify");
  const pendingRow = page.getByRole("row").filter({ hasText: recipient });
  await expect(pendingRow).toContainText("482913");
  await expect(pendingRow).toContainText("Pending");
  await expect(pendingRow).toContainText("0 / 5");
  await expect(pendingRow).toContainText(/Expires in \d+:\d\d/);

  await page.getByRole("link", { name: recipient }).click();
  const drawer = page.getByRole("dialog", { name: "Verification" });
  await expect(
    drawer
      .getByRole("list", { name: "Verification timeline" })
      .getByRole("listitem"),
  ).toHaveText([/Started/, /Code sent/]);
  await drawer.getByRole("link", { name: "Open the message" }).click();
  await expect(
    page.getByRole("dialog", { name: "Message details" }),
  ).toContainText("482913");
  expect(failedApiCalls).toEqual([]);
});

test("UI-12.2 Numbers lists a number registered through the API", async ({
  page,
  request,
}) => {
  const numberResponse = await request.post("/api/v1/numbers", {
    data: {
      number: "+15550004444",
      label: "Sales",
      channels: ["sms"],
      inbound_url: null,
      inbound_method: "POST",
      inbound_fallback_url: null,
      inbound_template_id: null,
      status_callback_url: null,
      messaging_service_sid: null,
    },
  });
  expect(numberResponse.status()).toBe(201);
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/numbers");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("row").filter({ hasText: "+15550004444" }),
  ).toContainText("Sales");
  expect(failedApiCalls).toEqual([]);
});

test("UI-12.2 SMS > Providers lists the built-ins served by the live binary", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/sms/providers");
  await page.waitForLoadState("networkidle");

  for (const providerName of ["Twilio", "Twilio Verify", "Vonage"]) {
    await expect(
      page
        .getByTestId("message-provider-row")
        .filter({ has: page.getByText(providerName, { exact: true }) }),
    ).toContainText("Built-in");
  }
  await expect(
    page.getByRole("button", { name: "Add provider: Available in Phase 4" }),
  ).toBeDisabled();
  expect(failedApiCalls).toEqual([]);
});
