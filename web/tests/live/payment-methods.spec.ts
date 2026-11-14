import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  buildCustomerEmail,
  buildLiveName,
  createCheckout,
  openCheckoutPage,
  resetPaymentDefinition,
} from "./live-payments";

function methodRow(page: Page, methodName: string) {
  return page.getByTestId("payment-method-row").filter({ hasText: methodName });
}

test.beforeEach(async ({ page, request }) => {
  await resetPaymentDefinition(request, "methods", "bkash");
  await page.goto("/payments/methods");
  await expect(methodRow(page, "bKash")).toBeVisible();
});

test("PY-12.1 the live table lists every built-in method with its gateways and test values", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);

  for (const methodName of [
    "Card",
    "PayPal account",
    "bKash",
    "Nagad",
    "Rocket",
    "DBBL Nexus",
    "City Touch",
    "BRAC iBanking",
  ]) {
    await expect(methodRow(page, methodName)).toBeVisible();
  }
  await expect(methodRow(page, "bKash")).toContainText("3 test numbers");
  await expect(methodRow(page, "DBBL Nexus")).toContainText("Always succeeds");
  await expect(
    page.getByRole("link", { name: "Methods", exact: true }),
  ).toHaveAttribute("data-active", "true");
  expect(failedApiCalls).toEqual([]);
});

test("PY-12.1 a live built-in method is edited, used by the next checkout, and reset to default", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "Edit bKash" }).click();
  const methodSheet = page.getByRole("dialog", { name: "bKash" });
  await methodSheet.getByLabel("Test OTP").fill("654321");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodSheet).toBeHidden();
  await expect(methodRow(page, "bKash")).toContainText("Modified");

  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("method-otp"),
    { provider: "bkash", currency: "BDT", amountMinor: 120_000 },
  );
  await openCheckoutPage(page, paymentId);
  await page.getByLabel("Your bKash account number").fill("01770000001");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Test code: 654321")).toBeVisible();

  await page.goto("/payments/methods");
  await page.getByRole("button", { name: "Edit bKash" }).click();
  await methodSheet.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(methodRow(page, "bKash")).not.toContainText("Modified");
});

test("PY-12.1 a live custom wallet method is added, checked and deleted while unused", async ({
  page,
}) => {
  const methodName = buildLiveName("Live Upay");
  await page.getByRole("button", { name: "Add method" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment method" });
  await addDialog.getByLabel("Name").fill(methodName);
  await addDialog.getByRole("button", { name: "Add method" }).click();

  const methodSheet = page.getByRole("dialog", { name: methodName });
  await methodSheet.getByLabel("Test PIN").fill("12");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodSheet.getByText("Use 4 to 6 digits")).toBeVisible();
  await methodSheet.getByLabel("Test PIN").fill("2468");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodRow(page, methodName)).toContainText("Custom");
  await expect(methodRow(page, methodName)).toContainText("No gateway yet");

  await page.reload();
  await page.getByRole("button", { name: `Edit ${methodName}` }).click();
  await methodSheet.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(methodRow(page, methodName)).toHaveCount(0);
});
