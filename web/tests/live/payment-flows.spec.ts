import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  buildCustomerEmail,
  buildLiveName,
  checkoutResult,
  createCheckout,
  openCheckoutPage,
  resetPaymentDefinition,
} from "./live-payments";

function flowRow(page: Page, flowName: string) {
  return page
    .getByTestId("payment-flow-row")
    .filter({ has: page.getByText(flowName, { exact: true }) });
}

async function openFlow(page: Page, flowName: string) {
  await page
    .getByRole("button", { name: `Edit ${flowName}`, exact: true })
    .click();
  return page.getByRole("dialog", { name: flowName });
}

async function deleteOpenItem(page: Page) {
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
}

test.beforeEach(async ({ page, request }) => {
  await resetPaymentDefinition(request, "flows", "wallet");
  await page.goto("/payments/flows");
  await expect(flowRow(page, "Wallet")).toBeVisible();
});

test("PY-12.6 the live table lists the built-in flows with their steps in order", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);

  for (const flowName of [
    "Card",
    "Wallet",
    "Bank",
    "Account",
    "QR",
    "Bank transfer",
    "Voucher",
  ]) {
    await expect(flowRow(page, flowName)).toBeVisible();
  }
  await expect(flowRow(page, "Wallet")).toContainText(
    "Account number, OTP, PIN",
  );
  expect(failedApiCalls).toEqual([]);
});

test("PY-12.6 a live built-in flow is edited step by step, run at checkout, and reset to default", async ({
  page,
  request,
}) => {
  const flowSheet = await openFlow(page, "Wallet");
  await flowSheet
    .getByRole("listitem", { name: "Step 2: OTP" })
    .getByLabel("Field label", { exact: true })
    .fill("SMS code for {method}");
  await flowSheet.getByRole("button", { name: "Move Step 3: PIN up" }).click();
  await expect(
    flowSheet.getByRole("listitem", { name: "Step 2: PIN" }),
  ).toBeVisible();
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowSheet).toBeHidden();
  await expect(flowRow(page, "Wallet")).toContainText(
    "Account number, PIN, OTP",
  );
  await expect(flowRow(page, "Wallet")).toContainText("Modified");

  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("flow-order"),
    { provider: "bkash", currency: "BDT", amountMinor: 120_000 },
  );
  await openCheckoutPage(page, paymentId);
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await expect(walletForm.getByText("Step 2 of 3")).toBeVisible();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await walletForm.getByLabel("SMS code for bKash").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");

  await page.goto("/payments/flows");
  await openFlow(page, "Wallet");
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(flowRow(page, "Wallet")).toContainText(
    "Account number, OTP, PIN",
  );
  await expect(flowRow(page, "Wallet")).not.toContainText("Modified");
});

test("PY-12.7 live labels insert a variable, preview it, refuse unknown ones and fill in at checkout", async ({
  page,
  request,
}) => {
  const flowSheet = await openFlow(page, "Wallet");
  await expect(
    flowSheet
      .getByRole("table", { name: "Label variables" })
      .getByRole("row")
      .filter({ hasText: "{merchant}" }),
  ).toContainText("The merchant name shown on checkout pages");
  const otpStep = flowSheet.getByRole("listitem", { name: "Step 2: OTP" });
  await otpStep.getByLabel("Field label", { exact: true }).fill("Code for ");
  await otpStep
    .getByRole("button", {
      name: "Insert variable into Step 2: OTP field label",
    })
    .click();
  await page.getByRole("menuitem", { name: /^\{merchant\}/ }).click();
  await expect(otpStep.getByLabel("Field label", { exact: true })).toHaveValue(
    "Code for {merchant}",
  );
  await expect(otpStep.getByTestId("step-preview")).toContainText(
    "Code for Acme Shop",
  );

  await otpStep
    .getByLabel("Button text", { exact: true })
    .fill("Pay {ammount}");
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(
    otpStep.getByText(/\{ammount\} is not a variable; use \{method\}/),
  ).toBeVisible();
  await otpStep.getByLabel("Button text", { exact: true }).fill("Pay {amount}");
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowSheet).toBeHidden();

  const paymentId = await createCheckout(
    request,
    buildCustomerEmail("flow-labels"),
    { provider: "bkash", currency: "BDT", amountMinor: 120_000 },
  );
  await openCheckoutPage(page, paymentId);
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await expect(walletForm.getByLabel("Code for Acme Shop")).toBeVisible();
  await expect(
    walletForm.getByRole("button", { name: "Pay BDT 1,200.00" }),
  ).toBeVisible();
  await resetPaymentDefinition(request, "flows", "wallet");
});

test("PY-12.6 a live custom flow is composed, used by a new method, and deleted once unused", async ({
  page,
}) => {
  const flowName = buildLiveName("Live Upay QR");
  const methodName = buildLiveName("Live QR wallet");
  await page.getByRole("button", { name: "Add flow" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment flow" });
  await addDialog.getByLabel("Name").fill(flowName);
  await addDialog.getByLabel("Picker tab").fill("Scan to pay");
  await addDialog.getByRole("button", { name: "Add flow" }).click();
  const flowSheet = page.getByRole("dialog", { name: flowName });
  await flowSheet.getByRole("button", { name: "Add step" }).click();
  await page.getByRole("menuitem", { name: /^QR code/ }).click();
  await flowSheet
    .getByRole("button", { name: "Remove Step 1: Confirm" })
    .click();
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowRow(page, flowName)).toContainText("Custom");
  await expect(flowRow(page, flowName)).toContainText("QR code");

  await page.goto("/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const methodDialog = page.getByRole("dialog", {
    name: "Add a payment method",
  });
  await methodDialog.getByText(flowName, { exact: true }).click();
  await methodDialog.getByLabel("Name").fill(methodName);
  await methodDialog.getByRole("button", { name: "Add method" }).click();
  await page
    .getByRole("dialog", { name: methodName })
    .getByRole("button", { name: "Cancel" })
    .click();

  await page.goto("/payments/flows");
  await expect(flowRow(page, flowName)).toContainText("1 method");
  await openFlow(page, flowName);
  await deleteOpenItem(page);
  await expect(
    page.getByText(/delete those methods first/).first(),
  ).toBeVisible();

  await page.goto("/payments/methods");
  await page.getByRole("button", { name: `Edit ${methodName}` }).click();
  await deleteOpenItem(page);
  await page.goto("/payments/flows");
  await openFlow(page, flowName);
  await deleteOpenItem(page);
  await expect(flowRow(page, flowName)).toHaveCount(0);
});
