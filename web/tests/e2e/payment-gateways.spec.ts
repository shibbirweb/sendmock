import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

function gatewayRow(page: Page, gatewayName: string) {
  return page
    .getByTestId("payment-gateway-row")
    .filter({ has: page.getByText(gatewayName, { exact: true }) });
}

async function openGateway(page: Page, gatewayName: string) {
  await page
    .getByRole("button", { name: `Edit ${gatewayName}`, exact: true })
    .click();
  return page.getByRole("dialog", { name: gatewayName });
}

const checkoutResult = (page: Page) =>
  page.getByRole("region", { name: "Checkout result" });

test.beforeEach(async ({ page }) => {
  await page.goto("/payments/gateways");
  await expect(gatewayRow(page, "SSLCommerz")).toBeVisible();
});

test("PY-12.2 the table lists every gateway with its methods and notification endpoint", async ({
  page,
}) => {
  await expect(page.getByTestId("payment-gateway-row")).toHaveCount(5);
  await expect(gatewayRow(page, "SSLCommerz")).toContainText(
    "Card, bKash, Nagad, Rocket, DBBL Nexus, City Touch, BRAC iBanking",
  );
  await expect(gatewayRow(page, "Stripe")).toContainText("Shop payments");
  await expect(
    page.getByRole("link", { name: "Gateways", exact: true }),
  ).toHaveAttribute("data-active", "true");
});

test("PY-12.2 a built-in is edited, used by its next notification, and reset to default", async ({
  page,
}) => {
  const gatewaySheet = await openGateway(page, "SSLCommerz");
  await gatewaySheet.getByRole("tab", { name: "Notification" }).click();
  await gatewaySheet
    .getByLabel("Event name for payment.succeeded")
    .fill("VALIDATED");
  await expect(
    gatewaySheet.getByTestId("notification-body-preview"),
  ).toContainText("status=VALIDATED");
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewaySheet).toBeHidden();
  await expect(gatewayRow(page, "SSLCommerz")).toContainText("Modified");

  await openGateway(page, "SSLCommerz");
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(gatewayRow(page, "SSLCommerz")).not.toContainText("Modified");
});

test("PY-12.4 the preview follows the chosen event and outcome; template errors block saving", async ({
  page,
}) => {
  const gatewaySheet = await openGateway(page, "PayPal");
  await gatewaySheet.getByRole("tab", { name: "Redirect" }).click();
  const preview = gatewaySheet.getByTestId("gateway-preview");
  await expect(preview).toContainText("PayerID");
  await gatewaySheet
    .getByRole("combobox", { name: "Preview redirect outcome" })
    .click();
  await page.getByRole("option", { name: "Redirect on cancel" }).click();
  await expect(preview.getByText("PayerID")).toHaveCount(0);

  await gatewaySheet.getByRole("combobox", { name: "Preview event" }).click();
  await page.getByRole("option", { name: "payment.created" }).click();
  await expect(preview).toContainText(
    "Nothing is sent for payment.created: it has no event name.",
  );

  await gatewaySheet
    .getByLabel("Redirect field 1 template")
    .fill("{{ payment.reference | shout }}");
  await expect(
    gatewaySheet.getByRole("list", { name: "Template problems" }),
  ).toContainText("Redirect field token: Unknown filter: shout");
  await expect(
    gatewaySheet.getByRole("button", { name: "Save gateway" }),
  ).toBeDisabled();
  await expect(gatewaySheet.getByRole("status")).toHaveText(
    "Fix 1 template error to save",
  );
});

test("PY-12.2 secrets stay masked until a confirmed reveal", async ({
  page,
}) => {
  const gatewaySheet = await openGateway(page, "SSLCommerz");
  await gatewaySheet.getByRole("tab", { name: "Merchant" }).click();
  const secretValue = gatewaySheet.getByLabel("Credential 2 value");
  await expect(secretValue).toHaveValue("••••@ssl");

  await gatewaySheet
    .getByRole("button", { name: "Reveal store_passwd" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reveal" })
    .click();
  await expect(secretValue).toHaveValue("sendm0000000001@ssl");
});

test("PY-12.3 a custom gateway is added, offers its methods and redirects with its own fields", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add gateway" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment gateway" });
  await addDialog.getByLabel("Name").fill("Nagad Pay");
  await expect(addDialog.getByLabel("Key")).toHaveValue("nagad_pay");
  await addDialog.getByRole("button", { name: "Add gateway" }).click();

  const gatewaySheet = page.getByRole("dialog", { name: "Nagad Pay" });
  await gatewaySheet.getByRole("tab", { name: "Checkout" }).click();
  await gatewaySheet.getByRole("button", { name: "Remove Card" }).click();
  await gatewaySheet.getByRole("combobox", { name: "Add a method" }).click();
  await page.getByRole("option", { name: "Nagad" }).click();
  await gatewaySheet.getByRole("tab", { name: "Redirect" }).click();
  await gatewaySheet.getByLabel("Redirect field 1 name").fill("payment_ref_id");
  await gatewaySheet
    .getByLabel("Redirect field 1 template")
    .fill("{{ payment.reference }}");
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewayRow(page, "Nagad Pay")).toContainText("Custom");
  await expect(gatewayRow(page, "Nagad Pay")).toContainText("Nagad");

  await openGateway(page, "Nagad Pay");
  await page.getByRole("tab", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Open a test checkout" }).click();
  await expect(page.getByText("Nagad Pay test checkout")).toBeVisible();
  const walletForm = page.getByRole("form", { name: "Nagad payment" });
  await walletForm.getByLabel("Your Nagad account number").fill("01880000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");
  await expect(checkoutResult(page)).toContainText("payment_ref_id");

  await navigateInApp(page, "/payments");
  await expect(
    page.getByTestId("payment-row").filter({ hasText: "Nagad Pay" }).first(),
  ).toContainText("Succeeded");
});
