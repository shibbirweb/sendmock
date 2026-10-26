import { expect, type Page, test } from "@playwright/test";

import { navigateInApp } from "./support/app-screens";

// Each test follows the UI steps of one walkthrough in docs/wiki/advanced/, so
// a renamed button or changed screen fails here (WS-06.4).

async function addWalletMethod(page: Page, methodName: string) {
  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment method" });
  await addDialog.getByText("Wallet", { exact: true }).click();
  await addDialog.getByLabel("Name").fill(methodName);
  await addDialog.getByRole("button", { name: "Add method" }).click();
  const methodSheet = page.getByRole("dialog", { name: methodName });
  await expect(methodSheet.getByLabel("Test OTP")).toHaveValue("123456");
  await expect(methodSheet.getByLabel("Test PIN")).toHaveValue("12121");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodSheet).toBeHidden();
}

test("WS-06.4 advanced create a payment gateway: Upay from method to a paid checkout", async ({
  page,
}) => {
  await page.goto("/payments/gateways");
  await addWalletMethod(page, "Upay");
  await expect(
    page.getByTestId("payment-method-row").filter({ hasText: "Upay" }),
  ).toContainText("No gateway yet");

  await navigateInApp(page, "/payments/gateways");
  await page.getByRole("button", { name: "Add gateway" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment gateway" });
  await addDialog.getByLabel("Name").fill("Upay");
  await expect(addDialog.getByLabel("Key")).toHaveValue("upay");
  await addDialog.getByRole("button", { name: "Add gateway" }).click();

  const gatewaySheet = page.getByRole("dialog", { name: "Upay" });
  await gatewaySheet.getByRole("tab", { name: "Checkout" }).click();
  await gatewaySheet.getByRole("button", { name: "Remove Card" }).click();
  await gatewaySheet.getByRole("combobox", { name: "Add a method" }).click();
  await page.getByRole("option", { name: "Upay" }).click();
  await gatewaySheet.getByRole("tab", { name: "Redirect" }).click();
  await gatewaySheet.getByLabel("Redirect field 1 name").fill("payment_ref_id");
  await gatewaySheet
    .getByLabel("Redirect field 1 template")
    .fill("{{ payment.reference }}");
  await gatewaySheet.getByRole("tab", { name: "Notification" }).click();
  await gatewaySheet
    .getByLabel("Event name for payment.succeeded")
    .fill("COMPLETED");
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewaySheet).toBeHidden();

  await page.getByRole("button", { name: "Edit Upay", exact: true }).click();
  await page.getByRole("tab", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Open a test checkout" }).click();
  await expect(page.getByText("Upay test checkout")).toBeVisible();
  const walletForm = page.getByRole("form", { name: "Upay payment" });
  await walletForm.getByLabel("Your Upay account number").fill("01600000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  const checkoutResult = page.getByRole("region", { name: "Checkout result" });
  await expect(checkoutResult).toContainText("Payment successful");
  await expect(checkoutResult).toContainText("payment_ref_id");
});

test("WS-06.4 advanced create a payment flow: a QR flow used by a new method", async ({
  page,
}) => {
  await page.goto("/payments/flows");
  await page.getByRole("button", { name: "Add flow" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment flow" });
  await addDialog.getByLabel("Name").fill("Upay QR");
  await expect(addDialog.getByLabel("Key")).toHaveValue("upay_qr");
  await addDialog.getByLabel("Picker tab").fill("Scan to pay");
  await addDialog.getByRole("button", { name: "Add flow" }).click();

  const flowSheet = page.getByRole("dialog", { name: "Upay QR" });
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByRole("menuitem", { name: /^QR code/ }).click();
  await flowSheet
    .getByRole("button", { name: "Remove Step 1: Confirm" })
    .click();
  await flowSheet
    .getByRole("listitem", { name: "Step 1: QR code" })
    .getByLabel("Button text", { exact: true })
    .fill("Paid in the app");
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  const flowRow = page
    .getByTestId("payment-flow-row")
    .filter({ has: page.getByText("Upay QR", { exact: true }) });
  await expect(flowRow).toContainText("Custom");
  await expect(flowRow).toContainText("QR code");

  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const methodDialog = page.getByRole("dialog", {
    name: "Add a payment method",
  });
  await methodDialog.getByText("Upay QR", { exact: true }).click();
  await methodDialog.getByLabel("Name").fill("Upay");
  await methodDialog.getByRole("button", { name: "Add method" }).click();
  await expect(
    page.getByRole("dialog", { name: "Upay" }).getByText("Upay QR flow"),
  ).toBeVisible();
});

test("WS-06.4 advanced templates: clone Postmark inbound and add a header", async ({
  page,
}) => {
  await page.goto("/webhooks/templates");
  await page.getByRole("tab", { name: "Email providers" }).click();
  await page
    .getByTestId("template-card")
    .filter({ hasText: "Postmark: inbound" })
    .click();
  await page.getByRole("button", { name: "Clone" }).click();
  const cloneDialog = page.getByRole("dialog", { name: "Clone template" });
  await cloneDialog.getByLabel("Name").fill("Postmark inbound with tenant");
  await cloneDialog.getByRole("button", { name: "Clone" }).click();

  const clonedSheet = page.getByRole("dialog", {
    name: "Postmark inbound with tenant",
    exact: true,
  });
  await clonedSheet.getByRole("button", { name: "Edit" }).click();
  await clonedSheet.getByRole("button", { name: "Add header" }).click();
  await clonedSheet.getByLabel("Header 1 name").fill("X-Tenant");
  await clonedSheet.getByLabel("Header 1 value").fill("{{ vars.tenant_id }}");
  await clonedSheet.getByRole("button", { name: "Save template" }).click();
  await expect(clonedSheet).toContainText("X-Tenant");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Custom" }).click();
  await expect(
    page
      .getByTestId("template-card")
      .filter({ hasText: "Postmark inbound with tenant" })
      .first(),
  ).toBeVisible();
});

test("WS-06.4 advanced catcher responses: a rate limit rule with a preview", async ({
  page,
}) => {
  await page.goto("/http");
  await page
    .getByRole("navigation", { name: "Bin list" })
    .getByRole("button", { name: /^push/ })
    .click();
  await page.getByRole("tab", { name: "Responses" }).click();
  await page.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a rule" });
  await ruleSheet.getByLabel("Name", { exact: true }).fill("Quota exceeded");
  await ruleSheet.getByLabel("Path").fill("/v1/*");
  await ruleSheet.getByLabel("Status code", { exact: true }).fill("429");
  await ruleSheet.getByLabel("Failure rate (%)").fill("10");
  await expect(ruleSheet.getByTestId("rule-match")).toHaveText(
    "This rule answers this request.",
  );
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(
    page.getByTestId("response-rule").filter({ hasText: "Quota exceeded" }),
  ).toContainText("Any method /v1/*: 429, 10% fail with 500");
  await expect(
    page.getByRole("button", { name: "Move Quota exceeded up" }),
  ).toBeVisible();
});

test("WS-06.4 advanced inbound routes: ticket replies with a named group", async ({
  page,
}) => {
  await page.goto("/webhooks/inbound-routes");
  await page.getByRole("button", { name: "Add route" }).click();
  const routeSheet = page.getByRole("dialog", { name: "Add route" });
  await routeSheet.getByLabel("Description").fill("Ticket replies");
  await routeSheet
    .getByLabel("Pattern")
    .fill("reply\\+(?P<ticket>[\\w-]+)@reply\\.app\\.test");
  await expect(routeSheet.getByTestId("route-expression")).toHaveText(
    'match_recipient("reply\\+(?P<ticket>[\\w-]+)@reply\\.app\\.test")',
  );
  await expect(routeSheet.getByTestId("route-match-count")).toBeVisible();

  await routeSheet
    .getByLabel("Action 1: Forward to URL target")
    .fill("http://localhost:8000/tickets/\\g<ticket>/replies");
  await routeSheet.getByRole("button", { name: "Add action" }).click();
  await page.getByRole("menuitem", { name: /^Stop/ }).click();
  await expect(
    routeSheet.getByRole("listitem", { name: "Action 2: Stop" }),
  ).toBeVisible();
  await routeSheet.getByRole("button", { name: "Add route" }).click();
  await expect(routeSheet).toBeHidden();
  await expect(
    page.getByTestId("inbound-route-row").filter({ hasText: "Ticket replies" }),
  ).toContainText("stop()");
});

test("WS-06.4 advanced outcome rules: an email address and an SMS number of your own", async ({
  page,
}) => {
  await page.goto("/settings?section=email");
  const addressRules = page
    .locator("section")
    .filter({ hasText: "Custom outcome addresses" });
  await addressRules.getByRole("button", { name: "Add address" }).click();
  const addressDialog = page.getByRole("dialog", {
    name: "New outcome address",
  });
  await addressDialog.getByLabel("Address or pattern").fill("*@blocked.test");
  await addressDialog.getByLabel("Outcome").click();
  await page.getByRole("option", { name: "Reject the recipient" }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await addressDialog.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel("Test an address").fill("someone@blocked.test");
  await expect(page.getByTestId("email-outcome-result")).toContainText(
    "Reject the recipient, 550 5.7.1",
  );

  await navigateInApp(page, "/settings?section=sms");
  const numberRules = page
    .locator("section")
    .filter({ hasText: "Custom outcome numbers" });
  await numberRules.getByRole("button", { name: "Add number" }).click();
  const numberDialog = page.getByRole("dialog", { name: "New outcome number" });
  await numberDialog.getByLabel("Number or pattern").fill("+15551112222");
  await numberDialog.getByLabel("Outcome").click();
  await page.getByRole("option", { name: "Accepted, then failed" }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await numberDialog.getByLabel("Error code").fill("30008");
  await numberDialog.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel("Test a number").fill("+15551112222");
  await expect(page.getByTestId("sms-outcome-result")).toContainText(
    "Accepted, then failed, 30008",
  );
});
