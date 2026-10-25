import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

async function openTestCheckout(page: Page, gatewayName: string) {
  await navigateInApp(page, "/payments/gateways");
  await page
    .getByRole("button", { name: `Edit ${gatewayName}`, exact: true })
    .click();
  await page.getByRole("tab", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Open a test checkout" }).click();
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/settings?section=payments");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
});

test("PY-09.4 the merchant name and default currency are used by the next checkout", async ({
  page,
}) => {
  await page.getByLabel("Merchant name").fill("Dhaka Books");
  await page.getByRole("combobox", { name: "Default currency" }).click();
  await page.getByRole("option", { name: "BDT" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();

  await openTestCheckout(page, "Stripe");
  await expect(page.getByText("Pay Dhaka Books")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay BDT/ })).toBeVisible();
});

test("PY-09.4 an automatic outcome settles new checkouts at once", async ({
  page,
}) => {
  await page.getByText("Always decline", { exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();

  await openTestCheckout(page, "Stripe");
  await expect(
    page.getByRole("region", { name: "Checkout result" }),
  ).toContainText("Payment declined");
});

test("PY-09.4 the test values follow each method's flow and name the gateways offering it", async ({
  page,
}) => {
  await expect(
    page.getByRole("table", { name: "Test cards" }).getByRole("row"),
  ).toContainText(["4242 4242 4242 4242"]);
  const bkashRow = page
    .getByRole("table", { name: "Test numbers and codes" })
    .getByRole("row")
    .filter({ hasText: "01770000001" });
  await expect(bkashRow).toContainText("OTP 123456, PIN 12121");
  await expect(bkashRow).toContainText("SSLCommerz, bKash");
  const otherMethods = page.getByRole("table", { name: "Other methods" });
  await expect(
    otherMethods.getByRole("row").filter({ hasText: "PayPal account" }),
  ).toContainText(
    "Signed in as sb-buyer@personal.example.com; always succeeds",
  );
  await expect(
    otherMethods.getByRole("row").filter({ hasText: "DBBL Nexus" }),
  ).toContainText("Always succeeds");
  await expect(
    page.getByRole("link", { name: "Payments > Gateways" }),
  ).toHaveAttribute("href", "/payments/gateways");
  await expect(
    page.getByRole("link", { name: "Payments > Methods" }),
  ).toHaveAttribute("href", "/payments/methods");
});

test("PY-09.4 a new gateway and a custom method show in the test values", async ({
  page,
}) => {
  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const methodDialog = page.getByRole("dialog", {
    name: "Add a payment method",
  });
  await methodDialog.getByText("Voucher", { exact: true }).click();
  await methodDialog.getByLabel("Name").fill("Gift card");
  await methodDialog.getByRole("button", { name: "Add method" }).click();
  await page
    .getByRole("dialog", { name: "Gift card" })
    .getByRole("button", { name: "Save method" })
    .click();

  await navigateInApp(page, "/payments/gateways");
  await page.getByRole("button", { name: "Add gateway" }).click();
  const gatewayDialog = page.getByRole("dialog", {
    name: "Add a payment gateway",
  });
  await gatewayDialog.getByLabel("Name").fill("Shop Pay");
  await gatewayDialog.getByRole("button", { name: "Add gateway" }).click();
  const gatewaySheet = page.getByRole("dialog", { name: "Shop Pay" });
  await gatewaySheet.getByRole("tab", { name: "Checkout" }).click();
  await gatewaySheet.getByRole("combobox", { name: "Add a method" }).click();
  await page.getByRole("option", { name: "Gift card" }).click();
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewaySheet).toBeHidden();

  await navigateInApp(page, "/settings?section=payments");
  const giftRow = page
    .getByRole("table", { name: "Test numbers and codes" })
    .getByRole("row")
    .filter({ hasText: "GIFT0001" });
  await expect(giftRow).toContainText("Gift card");
  await expect(giftRow).toContainText("Shop Pay");
  await expect(giftRow).not.toContainText("OTP");
});

test("PY-09.5 the Overview shows payments with the success rate and revenue per currency", async ({
  page,
}) => {
  await navigateInApp(page, "/");
  const paymentsTile = page
    .getByRole("list", { name: "Totals" })
    .getByRole("link", { name: /^Payments/ });
  await expect(paymentsTile).toContainText(/\d+ today, \d+% succeeded/);
  await expect(paymentsTile).toContainText("(test)");
  await paymentsTile.click();
  await expect(page).toHaveURL(/\/payments$/);
});
