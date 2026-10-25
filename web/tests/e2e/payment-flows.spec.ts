import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

function flowRow(page: Page, flowName: string) {
  return page
    .getByTestId("payment-flow-row")
    .filter({ has: page.getByText(flowName, { exact: true }) });
}

/** A payment's checkout page, reached in the app so the mock data stays. */
async function openCheckoutFor(page: Page, customerName: string) {
  await navigateInApp(page, "/payments");
  const paymentLink = page
    .getByTestId("payment-row")
    .filter({ hasText: customerName })
    .getByRole("link");
  const paymentId = new URL(
    (await paymentLink.getAttribute("href")) ?? "",
    "http://localhost",
  ).searchParams.get("payment");
  await navigateInApp(page, `/pay/${paymentId}`);
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

async function openFlow(page: Page, flowName: string) {
  await page
    .getByRole("button", { name: `Edit ${flowName}`, exact: true })
    .click();
  return page.getByRole("dialog", { name: flowName });
}

async function addStep(page: Page, stepName: string) {
  await page.getByRole("button", { name: "Add step" }).click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^${stepName}`) })
    .click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/payments/flows");
  await expect(flowRow(page, "Wallet")).toBeVisible();
});

test("PY-12.6 the table lists the built-in flows with their steps in order", async ({
  page,
}) => {
  await expect(page.getByTestId("payment-flow-row")).toHaveCount(7);
  await expect(flowRow(page, "Wallet")).toContainText(
    "Account number, OTP, PIN",
  );
  await expect(flowRow(page, "Wallet")).toContainText("Mobile banking");
  await expect(flowRow(page, "Wallet")).toContainText("3 methods");
  await expect(flowRow(page, "QR")).toContainText("None yet");
  await expect(flowRow(page, "Bank transfer")).toContainText("Reference code");
  await expect(page.getByRole("link", { name: "Flows" })).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("PY-12.6 a built-in flow is edited step by step, run at checkout, and reset to default", async ({
  page,
}) => {
  const flowSheet = await openFlow(page, "Wallet");
  const otpStep = flowSheet.getByRole("listitem", { name: "Step 2: OTP" });
  await otpStep.getByLabel("Field label").fill("SMS code for {method}");
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

  await openCheckoutFor(page, "Ruma Begum");
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await expect(walletForm.getByText("Step 2 of 3")).toBeVisible();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await walletForm.getByLabel("SMS code for bKash").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await expect(
    page.getByRole("region", { name: "Checkout result" }),
  ).toContainText("Payment successful");

  await navigateInApp(page, "/payments/flows");
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

test("PY-12.6 problems show before saving: no step, and one deciding step at most", async ({
  page,
}) => {
  const flowSheet = await openFlow(page, "Card");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(
    page.getByRole("menuitem", { name: /^Account number/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("menuitem", { name: /^Account number/ }),
  ).toContainText("The flow already has a deciding step");
  await page.keyboard.press("Escape");

  await flowSheet
    .getByRole("button", { name: "Remove Step 1: Card form" })
    .click();
  await expect(flowSheet.getByText("Add at least one step")).toBeVisible();
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowSheet).toBeVisible();
});

test("PY-12.6 a custom flow is composed, used by a new method, and deleted once unused", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add flow" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment flow" });
  await addDialog.getByLabel("Name").fill("Upay QR");
  await expect(addDialog.getByLabel("Key")).toHaveValue("upay_qr");
  await addDialog.getByLabel("Picker tab").fill("Scan to pay");
  await addDialog.getByRole("button", { name: "Add flow" }).click();

  const flowSheet = page.getByRole("dialog", { name: "Upay QR" });
  await addStep(page, "QR code");
  await flowSheet
    .getByRole("button", { name: "Remove Step 1: Confirm" })
    .click();
  await flowSheet
    .getByRole("listitem", { name: "Step 1: QR code" })
    .getByLabel("Button text")
    .fill("Paid in the app");
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowRow(page, "Upay QR")).toContainText("Custom");
  await expect(flowRow(page, "Upay QR")).toContainText("QR code");

  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Add method" }).click();
  const methodDialog = page.getByRole("dialog", {
    name: "Add a payment method",
  });
  await methodDialog.getByText("Upay QR", { exact: true }).click();
  await methodDialog.getByLabel("Name").fill("Upay");
  await methodDialog.getByRole("button", { name: "Add method" }).click();
  const methodSheet = page.getByRole("dialog", { name: "Upay" });
  await expect(methodSheet.getByText("Upay QR flow")).toBeVisible();
  await expect(
    methodSheet.getByRole("radio", { name: /Succeeds/ }),
  ).toBeVisible();
  await expect(methodSheet.getByLabel("Test PIN")).toHaveCount(0);
  await methodSheet.getByRole("button", { name: "Cancel" }).click();

  await navigateInApp(page, "/payments/flows");
  await expect(flowRow(page, "Upay QR")).toContainText("1 method");
  await openFlow(page, "Upay QR");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("1 methods use Upay QR; delete those methods first"),
  ).toBeVisible();

  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Edit Upay" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await navigateInApp(page, "/payments/flows");
  await openFlow(page, "Upay QR");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(flowRow(page, "Upay QR")).toHaveCount(0);
});

test("PY-12.6 a bank method pays by QR once its flow has a QR step", async ({
  page,
}) => {
  const flowSheet = await openFlow(page, "Bank");
  await addStep(page, "QR code");
  await flowSheet
    .getByRole("button", { name: "Remove Step 1: Confirm" })
    .click();
  await flowSheet.getByLabel("Picker tab").fill("Scan to pay");
  await flowSheet.getByRole("button", { name: "Save flow" }).click();
  await expect(flowSheet).toBeHidden();

  await openCheckoutFor(page, "Nadia Islam");
  await page.getByRole("tab", { name: "Scan to pay" }).click();
  await page.locator("label", { hasText: "City Touch" }).click();
  await expect(
    page.getByRole("img", { name: "Test QR code for City Touch" }),
  ).toBeVisible();
  await expect(
    page.getByText("Open City Touch and scan the code."),
  ).toBeVisible();
  await page.getByRole("button", { name: "I have paid" }).click();
  await expect(
    page.getByRole("region", { name: "Checkout result" }),
  ).toContainText("Payment successful");
});
