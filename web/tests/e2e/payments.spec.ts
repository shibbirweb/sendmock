import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/payments");
  await expect(page.getByTestId("payment-row").first()).toBeVisible();
});

function paymentRow(page: Page, customerName: string) {
  return page.getByTestId("payment-row").filter({ hasText: customerName });
}

async function openPayment(page: Page, customerName: string) {
  await paymentRow(page, customerName).getByRole("link").click();
  const paymentDrawer = page.getByRole("dialog", { name: "Payment" });
  await expect(
    paymentDrawer.getByRole("region", { name: "Payment overview" }),
  ).toBeVisible();

  return paymentDrawer;
}

async function simulate(
  page: Page,
  paymentDrawer: ReturnType<Page["getByRole"]>,
  ...menuPath: string[]
) {
  await paymentDrawer.getByRole("button", { name: "Simulate" }).click();
  for (const menuLabel of menuPath) {
    await page.getByRole("menuitem", { name: menuLabel, exact: true }).click();
  }
}

test("PY-09.1 the list filters by status, provider and currency, kept in the URL", async ({
  page,
}) => {
  await expect(paymentRow(page, "Yuki Sato")).toContainText("¥3,000");

  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(page).toHaveURL(/status=failed/);
  const failedRows = page.getByTestId("payment-row");
  await expect(failedRows.first()).toBeVisible();
  for (const statusText of await failedRows
    .locator("[data-payment-status]")
    .allTextContents()) {
    expect(statusText).toMatch(/^(Failed|Canceled)/);
  }

  await page.getByRole("combobox", { name: "Provider" }).click();
  await page.getByRole("option", { name: "SSLCommerz" }).click();
  await expect(page).toHaveURL(/provider=sslcommerz/);
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await expect(paymentRow(page, "Karim Hasan")).toBeVisible();

  await page.goto("/payments?currency=JPY");
  await expect(page.getByTestId("payment-row")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Currency" }).click();
  await page.getByRole("option", { name: "BDT" }).click();
  await expect(paymentRow(page, "Rahim Uddin")).toBeVisible();
});

test("PY-09.2 the detail shows ids, method, line items, timeline, redirect and notifications", async ({
  page,
}) => {
  const paymentDrawer = await openPayment(page, "Rahim Uddin");
  const overview = paymentDrawer.getByRole("region", {
    name: "Payment overview",
  });
  await expect(overview).toContainText("SSLCommerz");
  await expect(overview).toContainText("tran id");
  await expect(overview).toContainText("visa ending 4242, expires 12/34");
  await expect(
    paymentDrawer.getByRole("region", { name: "Line items" }),
  ).toContainText("Grocery order #4521");
  await expect(
    paymentDrawer.getByRole("region", { name: "Timeline" }),
  ).toContainText("Redirected to the success URL");
  const redirects = paymentDrawer.getByRole("region", { name: "Redirects" });
  await expect(redirects).toContainText("Used, POST");
  await expect(
    redirects.getByRole("definition").filter({ hasText: "VALID" }),
  ).toBeVisible();

  const notification = paymentDrawer
    .getByTestId("payment-notification")
    .first();
  await expect(notification).toContainText("VALID");
  await notification.click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=/);
  await expect(page.getByRole("dialog", { name: "Delivery" })).toContainText(
    "payment.succeeded",
  );
});

test("PY-09.3 a waiting checkout can be declined with a reason, and the result shows at once", async ({
  page,
}) => {
  const paymentDrawer = await openPayment(page, "Nadia Islam");
  await paymentDrawer.getByRole("button", { name: "Simulate" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Expire checkout" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Refund..." })).toBeHidden();
  await page.getByRole("menuitem", { name: "Decline" }).click();
  await page.getByRole("menuitem", { name: "Insufficient funds" }).click();

  const overview = paymentDrawer.getByRole("region", {
    name: "Payment overview",
  });
  await expect(overview).toContainText("Failed: insufficient funds");
  await expect(
    paymentDrawer.getByTestId("payment-notification").first(),
  ).toContainText("FAILED");
  await expect(paymentRow(page, "Nadia Islam")).toContainText(
    "Failed: insufficient funds",
  );
});

test("PY-09.3 refunds are capped, then a dispute is opened and lost", async ({
  page,
}) => {
  const paymentDrawer = await openPayment(page, "Ayesha Khan");
  await simulate(page, paymentDrawer, "Refund...");
  const refundDialog = page.getByRole("dialog", { name: "Refund payment" });
  await expect(refundDialog.getByLabel("Amount (USD)")).toHaveValue("49.00");
  await refundDialog.getByLabel("Amount (USD)").fill("60");
  await refundDialog.getByRole("button", { name: "Refund" }).click();
  await expect(
    refundDialog.getByText("That is more than is left to refund"),
  ).toBeVisible();
  await refundDialog.getByLabel("Amount (USD)").fill("20");
  await refundDialog.getByRole("button", { name: "Refund" }).click();
  await expect(refundDialog).toBeHidden();

  const overview = paymentDrawer.getByRole("region", {
    name: "Payment overview",
  });
  await expect(overview).toContainText("Partly refunded");
  await expect(overview).toContainText("$20.00");

  await simulate(page, paymentDrawer, "Open dispute");
  await expect(overview).toContainText("Disputed");
  await simulate(page, paymentDrawer, "Resolve dispute", "Lost");
  await expect(overview).toContainText("Refunded");
  await expect(overview).toContainText("lost");
});

test("PY-09.3 an authorized payment is captured, and a notification can be resent", async ({
  page,
}) => {
  const paymentDrawer = await openPayment(page, "Acme Ops");
  await simulate(page, paymentDrawer, "Capture");
  await expect(
    paymentDrawer.getByRole("region", { name: "Payment overview" }),
  ).toContainText("Succeeded");
  const notifications = paymentDrawer.getByTestId("payment-notification");
  await expect(notifications).toHaveCount(1);
  await expect(notifications.first()).toContainText("payment_intent.succeeded");

  await paymentDrawer
    .getByRole("button", { name: "Resend notification" })
    .click();
  await expect(notifications).toHaveCount(2);
});

test("PY-09.1 the list updates live when a payment changes elsewhere", async ({
  page,
}) => {
  const rowLink = paymentRow(page, "Lena Vogel").getByRole("link");
  const paymentId = new URL(
    (await rowLink.getAttribute("href")) ?? "",
    "http://localhost",
  ).searchParams.get("payment");

  await page.evaluate(async (simulatedPaymentId) => {
    await fetch(`/api/v1/payments/${simulatedPaymentId}/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "succeed" }),
    });
  }, paymentId);

  await expect(paymentRow(page, "Lena Vogel")).toContainText("Succeeded");
});
