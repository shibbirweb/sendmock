import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/overview");
  await expect(page.getByTestId("delivery-column").first()).toBeVisible();
});

function readTileValue(page: Page, tileTitle: string) {
  return page
    .locator("[data-slot=card]")
    .filter({ hasText: tileTitle })
    .getByTestId("metric-tile-value");
}

test("WH-11.3 the chart stacks outcomes per hour with a tooltip and a table view", async ({
  page,
}) => {
  const legend = page.getByRole("list", { name: "Legend" });
  await expect(legend).toContainText("Succeeded");
  await expect(legend).toContainText("Retrying");
  await expect(legend).toContainText("Failed");
  await expect(readTileValue(page, "Deliveries")).toHaveText(/^\d+$/);

  await page.getByTestId("delivery-column").last().hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Succeeded");
  await expect(tooltip).toContainText("p95 latency");

  await page.getByRole("group", { name: /Deliveries per hour/ }).focus();
  await page.keyboard.press("Home");
  await expect(tooltip).toBeVisible();

  await page.getByRole("switch", { name: "Show as table" }).click();
  await expect(
    page
      .getByRole("table", { name: "Deliveries per hour" })
      .locator("tbody tr"),
  ).toHaveCount(24);
});

test("WH-11.3 the range and endpoint narrow everything and stay in the URL", async ({
  page,
}) => {
  const deliveriesBefore = Number(
    await readTileValue(page, "Deliveries").textContent(),
  );

  await page.getByRole("radio", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.getByTestId("delivery-column")).toHaveCount(7);
  await expect
    .poll(async () =>
      Number(await readTileValue(page, "Deliveries").textContent()),
    )
    .toBeGreaterThan(deliveriesBefore);

  await page.getByRole("combobox", { name: "Endpoint" }).click();
  await page.getByRole("option", { name: "SMS status callbacks" }).click();
  await expect(page).toHaveURL(/endpoint=/);
  const endpointRows = page
    .locator("[data-slot=card]")
    .filter({ hasText: "By endpoint" })
    .locator("tbody tr");
  await expect(endpointRows).toHaveCount(1);
  await expect(endpointRows.first()).toContainText("SMS status callbacks");
});

test("WH-11.1 each endpoint shows success, p50 / p95, retries and top failure codes", async ({
  page,
}) => {
  const endpointsCard = page
    .locator("[data-slot=card]")
    .filter({ hasText: "By endpoint" });
  const callbacksRow = endpointsCard
    .locator("tbody tr")
    .filter({ hasText: "SMS status callbacks" });
  await expect(callbacksRow).toContainText(/\d+ ms \/ \d+ ms/);
  await expect(callbacksRow).toContainText("503 x");
  await expect(
    callbacksRow.getByRole("meter", {
      name: "SMS status callbacks success rate",
    }),
  ).toBeVisible();

  await expect(page.getByRole("list", { name: "Failure codes" })).toContainText(
    "HTTP 503",
  );

  await endpointsCard
    .getByRole("button", { name: "Laravel inbound mail" })
    .click();
  await expect(page.getByRole("combobox", { name: "Endpoint" })).toHaveText(
    "Laravel inbound mail",
  );
});

test("WH-11.1 Open failed deliveries opens the log on the Failed chip", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Open failed deliveries" }).click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?status=failed/);
  await expect(
    page.getByRole("button", { name: "Failed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("WH-11.3 new deliveries update the overview live", async ({ page }) => {
  const deliveriesBefore = Number(
    await readTileValue(page, "Deliveries").textContent(),
  );

  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample SMS" }).click();
  await page.keyboard.press("Escape");

  await expect
    .poll(
      async () => Number(await readTileValue(page, "Deliveries").textContent()),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(deliveriesBefore);
});
