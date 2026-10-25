import { expect, type Page, test } from "@playwright/test";

function findStatTile(page: Page, tileName: string) {
  return page
    .getByRole("list", { name: "Totals" })
    .getByRole("link", { name: new RegExp(`^${tileName}`) });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
});

test("UI-03.1 counts, success rate, latency and recent failures update live", async ({
  page,
}) => {
  const webhookTile = findStatTile(page, "Webhook success");
  await expect(webhookTile).toContainText(/\d+%/);
  await expect(webhookTile).toContainText(/p95 \d+ ms/);
  await expect(
    page.getByRole("list", { name: "Recent failures" }).getByRole("listitem"),
  ).toHaveCount(4);

  const emailTile = findStatTile(page, "Emails");
  const todayCountBefore = Number(
    /(\d+) today/.exec(
      (await emailTile.getByText(/today/).textContent()) ?? "",
    )?.[1],
  );
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample email" }).click();

  await expect(emailTile).toContainText(`${todayCountBefore + 1} today`);
});

test("UI-03.2 each recent failure links to its delivery", async ({ page }) => {
  const firstFailure = page
    .getByRole("list", { name: "Recent failures" })
    .getByRole("link")
    .first();

  await firstFailure.click();

  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=[0-9A-Z]+/);
});

test("UI-03.3 the activity chart shows every series per hour by hover, keys and table", async ({
  page,
}) => {
  const legend = page.getByRole("list", { name: "Legend" });
  await expect(legend).toContainText("Emails");
  await expect(legend).toContainText("SMS");
  await expect(legend).toContainText("HTTP requests");

  await page.getByTestId("activity-column").last().hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Emails");
  await expect(tooltip).toContainText("SMS");
  await expect(tooltip).toContainText("HTTP requests");
  await expect(tooltip).toContainText("Total");
  const lastHourTotal = await tooltip
    .locator("span", { hasText: "Total" })
    .locator("span")
    .last()
    .textContent();

  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  const chartPlot = page.getByRole("group", { name: /Activity per hour/ });
  await chartPlot.focus();
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
  await expect(tableRows.first().locator("td").first()).toHaveText(
    lastHourRange ?? "",
  );
  await expect(tableRows.first().locator("td").last()).toHaveText(
    lastHourTotal ?? "",
  );
});

test("UI-03.4 each webhook endpoint shows deliveries, success meter, latency, retries and failure codes", async ({
  page,
}) => {
  const smsCallbacksRow = page
    .getByRole("row")
    .filter({ hasText: "SMS status callbacks" });

  await expect(
    smsCallbacksRow.getByRole("meter", {
      name: "SMS status callbacks success rate",
    }),
  ).toHaveAttribute("aria-valuenow", /\d+/);
  await expect(smsCallbacksRow).toContainText(/\d+ ms \/ \d+ ms/);
  await expect(smsCallbacksRow).toContainText("no_response x");

  const unusedEndpointRow = page
    .getByRole("row")
    .filter({ hasText: "Everything as native JSON" });
  await expect(unusedEndpointRow).toContainText("n/a / n/a");
  await expect(unusedEndpointRow).toContainText("None");
});

test("UI-03.5 stat tiles show totals with today's counts and the connect card copies addresses", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const tileName of ["Emails", "SMS", "HTTP requests"]) {
    await expect(findStatTile(page, tileName)).toContainText(/\d+ today/);
  }
  await expect(findStatTile(page, "Verifications")).toContainText(
    /\d+ pending/,
  );

  await page.getByRole("button", { name: "Copy SMTP address" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "127.0.0.1:1025",
  );
  await page.getByRole("button", { name: "Copy API base URL" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://127.0.0.1:8025/api/v1",
  );

  await page.getByRole("link", { name: /More snippets/ }).click();
  await expect(page).toHaveURL(/\/settings\?section=connection/);
});
