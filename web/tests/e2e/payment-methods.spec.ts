import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

function methodRow(page: Page, methodName: string) {
  return page.getByTestId("payment-method-row").filter({ hasText: methodName });
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

test.beforeEach(async ({ page }) => {
  await page.goto("/payments/methods");
  await expect(methodRow(page, "bKash")).toBeVisible();
});

test("PY-12.1 the table lists every method with its flow, gateways and test values", async ({
  page,
}) => {
  await expect(page.getByTestId("payment-method-row")).toHaveCount(8);
  await expect(methodRow(page, "Card")).toContainText(
    "Stripe, Native, SSLCommerz",
  );
  await expect(methodRow(page, "bKash")).toContainText("3 test numbers");
  await expect(methodRow(page, "DBBL Nexus")).toContainText("Always succeeds");
  await expect(
    page.getByRole("link", { name: "All payments" }),
  ).not.toHaveAttribute("data-active", "true");
  await expect(page.getByRole("link", { name: "Methods" })).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("PY-12.1 a built-in method is edited, used by checkout pages, and reset to default", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Edit bKash" }).click();
  const methodSheet = page.getByRole("dialog", { name: "bKash" });
  await methodSheet.getByLabel("Test OTP").fill("654321");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodSheet).toBeHidden();
  await expect(methodRow(page, "bKash")).toContainText("Modified");

  await openCheckoutFor(page, "Ruma Begum");
  await page.getByLabel("Your bKash account number").fill("01770000001");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Test code: 654321")).toBeVisible();

  await navigateInApp(page, "/payments/methods");
  await page.getByRole("button", { name: "Edit bKash" }).click();
  await methodSheet.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(methodRow(page, "bKash")).not.toContainText("Modified");
});

test("PY-12.1 a custom wallet method is added, checked and deleted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add method" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment method" });
  await addDialog.getByLabel("Name").fill("Upay");
  await expect(addDialog.getByLabel("Key")).toHaveValue("upay");
  await addDialog.getByRole("button", { name: "Add method" }).click();

  const methodSheet = page.getByRole("dialog", { name: "Upay" });
  await methodSheet.getByLabel("Test PIN").fill("12");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodSheet.getByText("Use 4 to 6 digits")).toBeVisible();
  await methodSheet.getByLabel("Test PIN").fill("2468");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(methodRow(page, "Upay")).toContainText("Custom");
  await expect(methodRow(page, "Upay")).toContainText("No gateway yet");

  await page.getByRole("button", { name: "Edit Upay" }).click();
  await methodSheet.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(methodRow(page, "Upay")).toHaveCount(0);
});

test("PY-01.1 a card method refuses numbers outside the test ranges", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Edit Card" }).click();
  const methodSheet = page.getByRole("dialog", { name: "Card" });
  await methodSheet.getByLabel("Test card 1 number").fill("4111111111111111");
  await methodSheet.getByRole("button", { name: "Save method" }).click();
  await expect(
    methodSheet.getByText(/4111111111111111 is not a test card/),
  ).toBeVisible();
});

test("PY-12.3 a disabled method is no longer offered at checkout", async ({
  page,
}) => {
  await page.getByRole("switch", { name: "Nagad enabled" }).click();
  await expect(
    page.getByRole("switch", { name: "Nagad enabled" }),
  ).not.toBeChecked();

  await openCheckoutFor(page, "Nadia Islam");
  await page.getByRole("tab", { name: "Mobile banking" }).click();
  await expect(page.getByRole("radio", { name: "bKash" })).toHaveCount(1);
  await expect(page.getByRole("radio", { name: "Rocket" })).toHaveCount(1);
  await expect(page.getByRole("radio", { name: "Nagad" })).toHaveCount(0);
});
