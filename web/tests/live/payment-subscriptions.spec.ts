import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

function subscriptionRow(page: Page, customerEmail: string) {
  return page
    .getByTestId("subscription-row")
    .filter({ hasText: customerEmail });
}

async function startSubscription(
  page: Page,
  customerEmail: string,
  cardNumber: string,
) {
  await page.getByRole("button", { name: "New subscription" }).click();
  const newDialog = page.getByRole("dialog", { name: "New subscription" });
  await newDialog.getByLabel("Customer email").fill(customerEmail);
  await newDialog.getByLabel("Test card").fill(cardNumber);
  await newDialog.getByRole("button", { name: "Start subscription" }).click();
  await expect(newDialog).toBeHidden();
}

async function chooseRowAction(
  page: Page,
  customerEmail: string,
  actionName: string,
) {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: `More for ${customerEmail}` }).click();
  await page.getByRole("menuitem", { name: actionName }).click();
}

/** An address no other retry uses, since a retry finds the last try's subscriptions. */
function buildCustomerEmail(baseName: string): string {
  return `${baseName}-${test.info().retry + 1}@example.test`;
}

test("PY-07.4 a live subscription is charged, renewed when advanced and ends at the period end", async ({
  page,
}) => {
  const customerEmail = buildCustomerEmail("live-subscriber");
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto("/payments/subscriptions");

  await startSubscription(page, customerEmail, "4242424242424242");
  const row = subscriptionRow(page, customerEmail);
  await expect(row).toContainText("Active");
  await chooseRowAction(page, customerEmail, "Advance to renewal");
  await expect(row.getByRole("cell").nth(4)).toHaveText("2");
  await chooseRowAction(page, customerEmail, "Cancel at period end");
  await expect(row).toContainText("Ends at period end");
  await chooseRowAction(page, customerEmail, "Advance to renewal");

  await expect(row).toContainText("Canceled");
  expect(failedApiCalls).toEqual([]);
});

test("PY-07.4 a live subscription with a declining card is past due", async ({
  page,
}) => {
  const customerEmail = buildCustomerEmail("live-declined-subscriber");
  await page.goto("/payments/subscriptions");

  await startSubscription(page, customerEmail, "4000000000009995");

  await expect(subscriptionRow(page, customerEmail)).toContainText("Past due");
});
