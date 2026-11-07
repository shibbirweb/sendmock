import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import {
  createEndpoint,
  makeUniqueName,
  pickOption,
  sendTestDelivery,
  startWebhookReceiver,
  type WebhookReceiver,
} from "./live-webhooks";

let failingReceiver: WebhookReceiver;
let passingReceiver: WebhookReceiver;

test.beforeAll(async () => {
  failingReceiver = await startWebhookReceiver(503, "unavailable");
  passingReceiver = await startWebhookReceiver(200, "ok");
});

test.afterAll(async () => {
  await failingReceiver.close();
  await passingReceiver.close();
});

/** One endpoint answering 503 and one answering 200, each with two test deliveries. */
async function createMeasuredEndpoints(request: APIRequestContext) {
  const failingName = makeUniqueName("Live failing");
  const passingName = makeUniqueName("Live passing");
  const failingId = await createEndpoint(
    request,
    failingName,
    failingReceiver.url,
  );
  const passingId = await createEndpoint(
    request,
    passingName,
    passingReceiver.url,
  );
  for (const endpointId of [failingId, failingId, passingId, passingId]) {
    await sendTestDelivery(request, endpointId);
  }

  return { failingName, passingName, passingId };
}

function readTileValue(page: Page, tileTitle: string) {
  return page
    .locator("[data-slot=card]")
    .filter({ hasText: tileTitle })
    .getByTestId("metric-tile-value");
}

function findEndpointMetricsRows(page: Page) {
  return page
    .locator("[data-slot=card]")
    .filter({ hasText: "By endpoint" })
    .locator("tbody tr");
}

test("WH-11.1 each live endpoint shows success, p50 / p95 latency and top failure codes", async ({
  page,
  request,
}) => {
  const { failingName, passingName } = await createMeasuredEndpoints(request);
  await page.goto("/webhooks/overview");

  const failingRow = findEndpointMetricsRows(page).filter({
    hasText: failingName,
  });
  await expect(failingRow).toContainText(/\d+ ms \/ \d+ ms/);
  await expect(failingRow).toContainText("503 x");
  await expect(
    failingRow.getByRole("meter", { name: `${failingName} success rate` }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Failure codes" })).toContainText(
    "HTTP 503",
  );

  await page
    .locator("[data-slot=card]")
    .filter({ hasText: "By endpoint" })
    .getByRole("button", { name: passingName })
    .click();
  await expect(page.getByRole("combobox", { name: "Endpoint" })).toHaveText(
    passingName,
  );
  await page.getByRole("link", { name: "Open failed deliveries" }).click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?status=failed/);
  await expect(
    page.getByRole("button", { name: "Failed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("WH-11.3 the live chart stacks outcomes per hour with a legend, tooltip and table view", async ({
  page,
  request,
}) => {
  await createMeasuredEndpoints(request);
  await page.goto("/webhooks/overview");
  await expect(page.getByTestId("delivery-column").first()).toBeVisible();

  const legend = page.getByRole("list", { name: "Legend" });
  for (const outcomeName of ["Succeeded", "Retrying", "Failed"]) {
    await expect(legend).toContainText(outcomeName);
  }
  await expect(readTileValue(page, "Deliveries")).toHaveText(/^[1-9]\d*$/);
  await page.getByTestId("delivery-column").last().hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Succeeded");
  await expect(tooltip).toContainText("p95 latency");

  await page.getByRole("switch", { name: "Show as table" }).click();
  await expect(
    page
      .getByRole("table", { name: "Deliveries per hour" })
      .locator("tbody tr"),
  ).toHaveCount(24);
});

test("WH-11.3 the live overview narrows to 7 days and one endpoint, and updates as deliveries happen", async ({
  page,
  request,
}) => {
  const { failingName, passingId } = await createMeasuredEndpoints(request);
  await page.goto("/webhooks/overview");
  await expect(page.getByTestId("delivery-column").first()).toBeVisible();

  await page.getByRole("radio", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.getByTestId("delivery-column")).toHaveCount(7);
  await pickOption(page, "Endpoint", failingName);
  await expect(page).toHaveURL(/endpoint=/);
  await expect(findEndpointMetricsRows(page)).toHaveCount(1);
  await expect(findEndpointMetricsRows(page).first()).toContainText(
    failingName,
  );
  await expect(readTileValue(page, "Deliveries")).toHaveText("2");

  await page.getByRole("radio", { name: "24 hours" }).click();
  await pickOption(page, "Endpoint", "All endpoints");
  const deliveriesBefore = Number(
    await readTileValue(page, "Deliveries").textContent(),
  );
  await sendTestDelivery(request, passingId);
  await expect
    .poll(
      async () => Number(await readTileValue(page, "Deliveries").textContent()),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(deliveriesBefore);
});
