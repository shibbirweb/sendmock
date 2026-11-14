import { expect, type Page, test } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await page.goto("/payments/subscriptions");
  await expect(
    page.getByRole("heading", { name: "Subscriptions", level: 2 }),
  ).toBeVisible();
});

test("PY-07.4 a subscription starts, renews when advanced and ends at the period end", async ({
  page,
}) => {
  await startSubscription(page, "sam@example.test", "4242424242424242");
  const row = subscriptionRow(page, "sam@example.test");
  await expect(row).toContainText("Active");

  await chooseRowAction(page, "sam@example.test", "Advance to renewal");
  await expect(row.getByRole("cell").nth(4)).toHaveText("2");
  await chooseRowAction(page, "sam@example.test", "Cancel at period end");
  await expect(row).toContainText("Ends at period end");
  await chooseRowAction(page, "sam@example.test", "Advance to renewal");

  await expect(row).toContainText("Canceled");
  await expect(
    page.getByRole("button", { name: "More for sam@example.test" }),
  ).toBeDisabled();
});

test("PY-07.4 a declining test card leaves the subscription past due, and a real card is refused", async ({
  page,
}) => {
  await startSubscription(page, "lee@example.test", "4000000000009995");
  await expect(subscriptionRow(page, "lee@example.test")).toContainText(
    "Past due",
  );

  await page.getByRole("button", { name: "New subscription" }).click();
  const newDialog = page.getByRole("dialog", { name: "New subscription" });
  await newDialog.getByLabel("Customer email").fill("kim@example.test");
  await newDialog.getByLabel("Test card").fill("4111111111111111");
  await newDialog.getByRole("button", { name: "Start subscription" }).click();

  await expect(newDialog.getByRole("alert")).toHaveText("Use a test card");
});
