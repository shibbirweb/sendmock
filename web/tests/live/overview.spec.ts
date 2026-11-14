import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  createEndpoint,
  makeUniqueName,
  sendEmail,
  sendTestDelivery,
  startWebhookReceiver,
  waitForDelivery,
  type WebhookReceiver,
} from "./live-webhooks";

type LiveStats = {
  emails_today: number;
  sms_today: number;
  http_requests_today: number;
  pending_verification_count: number;
  activity: {
    email_count: number;
    sms_count: number;
    http_request_count: number;
  }[];
  recent_failures: { delivery_id: string; endpoint_name: string }[];
};

let failingReceiver: WebhookReceiver;
let passingReceiver: WebhookReceiver;

test.beforeAll(async () => {
  failingReceiver = await startWebhookReceiver(500, "broken");
  passingReceiver = await startWebhookReceiver(200, "ok");
});

test.afterAll(async () => {
  await failingReceiver.close();
  await passingReceiver.close();
});

async function readStats(request: APIRequestContext): Promise<LiveStats> {
  return (await (await request.get("/api/v1/stats")).json()) as LiveStats;
}

function findStatTile(page: Page, tileName: string) {
  return page
    .getByRole("list", { name: "Totals" })
    .getByRole("link", { name: new RegExp(`^${tileName}`) });
}

async function openOverview(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
}

/** An endpoint whose one test delivery failed with a 500, so it is a recent failure. */
async function createFailedDelivery(request: APIRequestContext) {
  const endpointName = makeUniqueName("Live overview failing");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    failingReceiver.url,
  );
  await sendTestDelivery(request, endpointId);
  const failedDelivery = await waitForDelivery(
    request,
    endpointId,
    "exhausted",
  );

  return { endpointName, failedDeliveryId: failedDelivery.id };
}

async function sendOneOfEachTraffic(request: APIRequestContext) {
  await sendEmail(request, makeUniqueName("Live activity email"));
  const smsResponse = await request.post("/api/v1/sms", {
    data: {
      from: "+15550001111",
      to: "+15550002222",
      body: "Live activity SMS",
    },
  });
  expect(smsResponse.status()).toBe(201);
  await request.post(`/catch/live-activity-${Date.now().toString(36)}/orders`, {
    data: { event: "paid" },
  });
}

test("UI-03.1 the live counts, success rate, latency and recent failures follow the binary's traffic", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  await openOverview(page);
  const emailTile = findStatTile(page, "Emails");
  const emailsTodayBefore = (await readStats(request)).emails_today;
  await expect(emailTile).toContainText(`${emailsTodayBefore} today`);

  await sendEmail(request, makeUniqueName("Live overview email"));
  await expect(emailTile).toContainText(`${emailsTodayBefore + 1} today`);

  const { endpointName } = await createFailedDelivery(request);
  await expect(
    page
      .getByRole("list", { name: "Recent failures" })
      .getByRole("link")
      .first(),
  ).toContainText(endpointName);
  const webhookTile = findStatTile(page, "Webhook success");
  await expect(webhookTile).toContainText(/\d+%/);
  await expect(webhookTile).toContainText(/p95 \d+ ms/);
  expect(failedApiCalls).toEqual([]);
});

test("UI-03.2 a live recent failure opens its delivery", async ({
  page,
  request,
}) => {
  const { endpointName, failedDeliveryId } =
    await createFailedDelivery(request);
  await openOverview(page);

  await page
    .getByRole("list", { name: "Recent failures" })
    .getByRole("link")
    .filter({ hasText: endpointName })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/webhooks/deliveries\\?delivery=${failedDeliveryId}`),
  );
  await expect(
    page
      .getByRole("dialog", { name: "Delivery" })
      .getByText(endpointName, { exact: true }),
  ).toBeVisible();
});

test("UI-03.3 the live activity chart shows the binary's hourly counts by hover, keys and table", async ({
  page,
  request,
}) => {
  await sendOneOfEachTraffic(request);
  const currentHour = (await readStats(request)).activity.at(-1);
  const currentHourTotal =
    (currentHour?.email_count ?? 0) +
    (currentHour?.sms_count ?? 0) +
    (currentHour?.http_request_count ?? 0);
  await openOverview(page);

  const legend = page.getByRole("list", { name: "Legend" });
  for (const seriesName of ["Emails", "SMS", "HTTP requests"]) {
    await expect(legend).toContainText(seriesName);
  }
  await page.getByTestId("activity-column").last().hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Emails");
  await expect(
    tooltip.locator("span", { hasText: "Total" }).locator("span").last(),
  ).toHaveText(String(currentHourTotal));
  await page.mouse.move(0, 0);
  await page.getByRole("group", { name: /Activity per hour/ }).focus();
  await page.keyboard.press("End");
  const lastHourRange = await tooltip.locator("span").first().textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(tooltip.locator("span").first()).not.toHaveText(
    lastHourRange ?? "",
  );

  await page.getByRole("switch", { name: "Show as table" }).click();
  const tableRows = page
    .getByRole("table", { name: "Activity per hour" })
    .locator("tbody tr");
  await expect(tableRows).toHaveCount(24);
  await expect(tableRows.first().locator("td").last()).toHaveText(
    String(currentHourTotal),
  );
});

test("UI-03.4 the live endpoint card shows deliveries, success meter, latency and failure codes", async ({
  page,
  request,
}) => {
  const { endpointName } = await createFailedDelivery(request);
  const passingName = makeUniqueName("Live overview passing");
  const passingId = await createEndpoint(
    request,
    passingName,
    passingReceiver.url,
  );
  await sendTestDelivery(request, passingId);
  await waitForDelivery(request, passingId, "succeeded");
  await openOverview(page);
  const endpointCard = page
    .locator("[data-slot=card]")
    .filter({ hasText: "Webhooks by endpoint" });

  const failingRow = endpointCard
    .getByRole("row")
    .filter({ hasText: endpointName });
  await expect(
    failingRow.getByRole("meter", { name: `${endpointName} success rate` }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(failingRow).toContainText("500 x1");
  const passingRow = endpointCard
    .getByRole("row")
    .filter({ hasText: passingName });
  await expect(
    passingRow.getByRole("meter", { name: `${passingName} success rate` }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(passingRow).toContainText(/\d+ ms \/ \d+ ms/);
  await expect(passingRow).toContainText("None");
});

test("UI-03.5 live stat tiles show today's counts and the connect card copies the binary's addresses", async ({
  page,
  request,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await sendOneOfEachTraffic(request);
  const liveStats = await readStats(request);
  const appInfo = (await (await request.get("/api/v1/info")).json()) as {
    smtp_address: string;
    http_address: string;
    is_container: boolean;
  };
  // In a container the UI defaults to the Compose host (UI-04.3).
  const expectedHost = appInfo.is_container ? "sendmock" : "127.0.0.1";
  await openOverview(page);

  await expect(findStatTile(page, "Emails")).toContainText(
    `${liveStats.emails_today} today`,
  );
  await expect(findStatTile(page, "SMS")).toContainText(
    `${liveStats.sms_today} today`,
  );
  await expect(findStatTile(page, "HTTP requests")).toContainText(
    `${liveStats.http_requests_today} today`,
  );
  await expect(findStatTile(page, "Verifications")).toContainText(
    `${liveStats.pending_verification_count} pending`,
  );

  const smtpPort = appInfo.smtp_address.split(":").pop() ?? "";
  const httpPort = appInfo.http_address.split(":").pop() ?? "";
  await page.getByRole("button", { name: "Copy SMTP address" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${expectedHost}:${smtpPort}`,
  );
  await page.getByRole("button", { name: "Copy API base URL" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `http://${expectedHost}:${httpPort}/api/v1`,
  );
});
