import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/deliveries");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

async function readTotalCount(page: Page): Promise<number> {
  const showingText =
    (await page.getByText(/^Showing \d+ of [\d,]+$/).textContent()) ?? "";

  return Number(
    /of ([\d,]+)/.exec(showingText)?.[1]?.replaceAll(",", "") ?? "0",
  );
}

async function pickOption(
  page: Page,
  comboboxName: string,
  optionName: string,
) {
  await page.getByRole("combobox", { name: comboboxName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

async function openDelivery(page: Page, rowText: string) {
  await page
    .locator("tbody tr")
    .filter({ hasText: rowText })
    .first()
    .getByRole("link")
    .click();
  const deliveryDrawer = page.getByRole("dialog", { name: "Delivery" });
  await expect(deliveryDrawer.getByText("Event id")).toBeVisible();

  return deliveryDrawer;
}

test("WH-03.7 the log shows each delivery and narrows by status, endpoint and event", async ({
  page,
}) => {
  for (const columnName of [
    "Time",
    "Event",
    "Endpoint",
    "Trigger",
    "Status",
    "Duration",
    "Attempt",
  ]) {
    await expect(
      page.getByRole("columnheader", { name: columnName }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(
    page.locator("tbody tr").filter({ hasText: /Succeeded|^200$/ }),
  ).toHaveCount(0);
  await expect(page.locator("[data-delivery-status='succeeded']")).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "All", exact: true }).click();
  await pickOption(page, "Endpoint filter", "Team Slack alerts");
  await pickOption(page, "Event filter", "test.ping");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Team Slack alerts");

  await pickOption(page, "Event filter", "verify.started");
  await expect(
    page.getByText("No deliveries match these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("WH-03.7 the log loads 50 rows at a time and shows new deliveries live", async ({
  page,
}) => {
  await expect(page.locator("tbody tr")).toHaveCount(50);
  const totalBefore = await readTotalCount(page);
  expect(totalBefore).toBeGreaterThan(50);

  // Scrolling the footer into view loads the next page by itself; clicking
  // Load more as well would race that load, which disables the button.
  await page.getByText(/^Showing 50 of/).scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(50);

  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample SMS" }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => readTotalCount(page), { timeout: 15_000 })
    .toBeGreaterThan(totalBefore);
});

test("WH-03.8 the detail shows request and response, attempts, cause and cURL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const deliveryDrawer = await openDelivery(page, "Failed, will retry");

  await expect(
    deliveryDrawer.getByRole("region", { name: "Request", exact: true }),
  ).toContainText("POST");
  await expect(
    deliveryDrawer.getByRole("region", { name: "Response", exact: true }),
  ).toContainText("500");
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request body" }),
  ).toContainText('"type": "sms.status"');
  await expect(deliveryDrawer.getByText("Caused by")).toBeVisible();
  const attemptsList = deliveryDrawer.getByRole("region", { name: "Attempts" });
  await expect(attemptsList.getByRole("link")).toHaveCount(2);
  await attemptsList.getByRole("link", { name: /Attempt 1/ }).click();
  await expect(deliveryDrawer.getByText("1 of 5")).toBeVisible();

  await deliveryDrawer.getByRole("button", { name: "Copy as cURL" }).click();
  const curlCommand = await page.evaluate(() => navigator.clipboard.readText());
  expect(curlCommand).toMatch(
    /^curl -X POST 'http:\/\/localhost:3000\/sms\/status'/,
  );
  expect(curlCommand).toContain("-H 'webhook-signature: v1,");
});

test("WH-03.9 Cancel retries marks a retrying delivery cancelled", async ({
  page,
}) => {
  const deliveryDrawer = await openDelivery(page, "Failed, will retry");
  await deliveryDrawer.getByRole("button", { name: "Cancel retries" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel retries" })
    .click();

  await expect(
    deliveryDrawer.locator("[data-delivery-status='cancelled']"),
  ).toBeVisible();
  await expect(
    deliveryDrawer.getByRole("button", { name: "Cancel retries" }),
  ).toBeHidden();
  await expect(deliveryDrawer.getByText("Next attempt")).toBeHidden();
});

test("WH-03.9 a render failure shows the template error instead of a request", async ({
  page,
}) => {
  const deliveryDrawer = await openDelivery(page, "Render failed");

  await expect(deliveryDrawer.getByRole("alert")).toContainText(
    "Template error",
  );
  await expect(deliveryDrawer.getByText("Nothing was sent")).toBeVisible();
  await expect(
    deliveryDrawer.getByRole("button", { name: "Replay", exact: true }),
  ).toBeHidden();
});

test("WH-05.2 replay as-is, re-render, and edit and replay create new deliveries", async ({
  page,
}) => {
  const deliveryDrawer = await openDelivery(page, "Laravel inbound mail");
  const firstUrl = page.url();

  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Replay as-is" }).click();
  await expect(page).not.toHaveURL(firstUrl);
  await expect(
    deliveryDrawer.getByText("replay", { exact: true }),
  ).toBeVisible();

  await deliveryDrawer
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Re-render with fresh values" })
    .click();
  await expect(page.getByText("Replayed").first()).toBeVisible();

  await deliveryDrawer.getByRole("button", { name: "Edit and replay" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit and replay" });
  await editDialog.getByLabel("Body").fill("{ not json");
  await editDialog.getByRole("button", { name: "Send edited request" }).click();
  await expect(
    editDialog.getByText("The body is not valid JSON"),
  ).toBeVisible();
  await editDialog.getByLabel("Body").fill('{"edited":true}');
  await editDialog.getByRole("button", { name: "Send edited request" }).click();
  await expect(editDialog).toBeHidden();
  await expect(
    deliveryDrawer.getByRole("region", { name: "Request body" }),
  ).toContainText('"edited": true');
});

test("a delivery can be saved with a name", async ({ page }) => {
  const deliveryDrawer = await openDelivery(page, "Team Slack alerts");
  await deliveryDrawer.getByRole("button", { name: "Save" }).click();
  const saveDialog = page.getByRole("dialog", { name: "Save this delivery" });
  await saveDialog.getByLabel("Name").fill("Slack bounce alert");
  await saveDialog.getByRole("button", { name: "Save" }).click();

  await expect(saveDialog).toBeHidden();
  await expect(page.getByText("Slack bounce alert")).toBeVisible();
});
