import { expect, type Page, test } from "@playwright/test";

async function payWithTestCard(
  page: Page,
  customerEmail: string,
  cardNumber: string,
) {
  await page.getByRole("button", { name: "New payment" }).click();
  const newDialog = page.getByRole("dialog", { name: "New payment" });
  await newDialog.getByLabel("Customer email").fill(customerEmail);
  await newDialog.getByLabel("Test card").fill(cardNumber);
  await newDialog.getByRole("button", { name: "Pay" }).click();

  return newDialog;
}

function paymentRow(page: Page, customerEmail: string) {
  return page.getByTestId("payment-row").filter({ hasText: customerEmail });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/payments");
  await expect(
    page.getByRole("heading", { name: "Payments", level: 2 }),
  ).toBeVisible();
});

test("PY-02.1 New payment pays with a test card and takes the card's outcome", async ({
  page,
}) => {
  const paidDialog = await payWithTestCard(
    page,
    "paid@example.test",
    "4242 4242 4242 4242",
  );
  await expect(paidDialog).toBeHidden();
  const declinedDialog = await payWithTestCard(
    page,
    "declined@example.test",
    "4000000000009995",
  );
  await expect(declinedDialog).toBeHidden();

  await expect(paymentRow(page, "paid@example.test")).toContainText(
    "Succeeded",
  );
  await expect(paymentRow(page, "declined@example.test")).toContainText(
    "Failed",
  );
});

test("PY-01.2 New payment refuses a real card number and stores nothing", async ({
  page,
}) => {
  const newDialog = await payWithTestCard(
    page,
    "real-card@example.test",
    "4111111111111111",
  );

  await expect(newDialog.getByRole("alert")).toContainText("Use a test card");
  await newDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(paymentRow(page, "real-card@example.test")).toHaveCount(0);
});
