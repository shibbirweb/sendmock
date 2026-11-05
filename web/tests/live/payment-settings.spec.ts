import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { buildLiveName, checkoutResult } from "./live-payments";

type PaymentSettings = {
  payment_merchant_name: string;
  payment_default_currency: string;
  payment_outcome_profile: string;
};

let defaultPaymentSettings: PaymentSettings | null = null;

async function openTestCheckout(page: Page, gatewayName: string) {
  await page.goto("/payments/gateways");
  await page
    .getByRole("button", { name: `Edit ${gatewayName}`, exact: true })
    .click();
  await page.getByRole("tab", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Open a test checkout" }).click();
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

async function saveSettings(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
}

test.beforeEach(async ({ page, request }) => {
  const settings = (await (
    await request.get("/api/v1/settings")
  ).json()) as PaymentSettings;
  defaultPaymentSettings ??= {
    payment_merchant_name: settings.payment_merchant_name,
    payment_default_currency: settings.payment_default_currency,
    payment_outcome_profile: settings.payment_outcome_profile,
  };
  await page.goto("/settings?section=payments");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
});

// The live binary is shared by the whole run, so later tests must see the defaults again.
test.afterEach(async ({ request }) => {
  const restoreResponse = await request.patch("/api/v1/settings", {
    data: defaultPaymentSettings ?? {},
  });
  expect(restoreResponse.ok()).toBe(true);
});

test("PY-09.4 the live merchant name and default currency are used by the next checkout", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  await page.getByLabel("Merchant name").fill("Live Dhaka Books");
  await page.getByRole("combobox", { name: "Default currency" }).click();
  await page.getByRole("option", { name: "BDT" }).click();
  await saveSettings(page);

  await openTestCheckout(page, "Stripe");

  await expect(page.getByText("Pay Live Dhaka Books")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay BDT/ })).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});

test("PY-09.4 a live automatic outcome settles new checkouts at once", async ({
  page,
}) => {
  await page.getByText("Always decline", { exact: true }).click();
  await saveSettings(page);

  await openTestCheckout(page, "Stripe");

  await expect(checkoutResult(page)).toContainText("Payment declined");
});

test("PY-09.4 the live test values follow each method's flow and name the gateways offering it", async ({
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

test("PY-09.4 a live custom gateway and custom method show in the test values", async ({
  page,
}) => {
  const methodName = buildLiveName("Live gift card");
  const gatewayName = buildLiveName("Live Shop Pay");
  await page.goto("/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const methodDialog = page.getByRole("dialog", {
    name: "Add a payment method",
  });
  await methodDialog.getByText("Voucher", { exact: true }).click();
  await methodDialog.getByLabel("Name").fill(methodName);
  await methodDialog.getByRole("button", { name: "Add method" }).click();
  await page
    .getByRole("dialog", { name: methodName })
    .getByRole("button", { name: "Save method" })
    .click();

  await page.goto("/payments/gateways");
  await page.getByRole("button", { name: "Add gateway" }).click();
  const gatewayDialog = page.getByRole("dialog", {
    name: "Add a payment gateway",
  });
  await gatewayDialog.getByLabel("Name").fill(gatewayName);
  await gatewayDialog.getByRole("button", { name: "Add gateway" }).click();
  const gatewaySheet = page.getByRole("dialog", { name: gatewayName });
  await gatewaySheet.getByRole("tab", { name: "Checkout" }).click();
  await gatewaySheet.getByRole("combobox", { name: "Add a method" }).click();
  await page.getByRole("option", { name: methodName }).click();
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewaySheet).toBeHidden();

  await page.goto("/settings?section=payments");
  const giftRow = page
    .getByRole("table", { name: "Test numbers and codes" })
    .getByRole("row")
    .filter({ hasText: methodName });
  await expect(giftRow).toContainText("GIFT0001");
  await expect(giftRow).toContainText(gatewayName);
  await expect(giftRow).not.toContainText("OTP");
});
