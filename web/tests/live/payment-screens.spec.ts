import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  buildCustomerEmail,
  createCheckout,
  openPaymentDrawer,
  paymentRow,
  payWithTestCard,
  sendGatewayNotifications,
  simulatePayment,
} from "./live-payments";

test("PY-09.1 the live list filters by status, provider and currency, kept in the URL", async ({
  page,
  request,
}) => {
  const paidEmail = buildCustomerEmail("filters-paid");
  const declinedEmail = buildCustomerEmail("filters-declined");
  const paidPaymentId = await createCheckout(request, paidEmail, {
    provider: "sslcommerz",
    currency: "BDT",
    amountMinor: 120_000,
  });
  await simulatePayment(request, paidPaymentId, { action: "succeed" });
  const declinedPaymentId = await createCheckout(request, declinedEmail, {
    currency: "JPY",
    amountMinor: 3_000,
  });
  await simulatePayment(request, declinedPaymentId, { action: "decline" });
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/payments");
  await expect(paymentRow(page, paidEmail)).toContainText("SSLCommerz");
  await expect(paymentRow(page, declinedEmail)).toContainText("¥3,000");

  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(page).toHaveURL(/status=failed/);
  await expect(paymentRow(page, declinedEmail)).toBeVisible();
  await expect(paymentRow(page, paidEmail)).toHaveCount(0);
  for (const statusText of await page
    .getByTestId("payment-row")
    .locator("[data-payment-status]")
    .allTextContents()) {
    expect(statusText).toMatch(/^(Failed|Canceled)/);
  }

  await page.getByRole("button", { name: "Succeeded", exact: true }).click();
  await page.getByRole("combobox", { name: "Provider" }).click();
  await page.getByRole("option", { name: "SSLCommerz" }).click();
  await expect(page).toHaveURL(/provider=sslcommerz/);
  await page.getByRole("combobox", { name: "Currency" }).click();
  await page.getByRole("option", { name: "BDT" }).click();
  await expect(page).toHaveURL(/currency=BDT/);
  await expect(paymentRow(page, paidEmail)).toBeVisible();
  for (const rowText of await page
    .getByTestId("payment-row")
    .allTextContents()) {
    expect(rowText).toContain("SSLCommerz");
  }

  await page.goto("/payments?currency=JPY&status=failed");
  await expect(paymentRow(page, declinedEmail)).toBeVisible();
  await expect(paymentRow(page, paidEmail)).toHaveCount(0);
  expect(failedApiCalls).toEqual([]);
});

test("PY-09.1 the live list shows new payments and status changes without a reload", async ({
  page,
  request,
}) => {
  const customerEmail = buildCustomerEmail("live-updates");
  await page.goto("/payments");
  await expect(
    page.getByRole("heading", { name: "Payments", level: 2 }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  const paymentId = await createCheckout(request, customerEmail);
  await expect(paymentRow(page, customerEmail)).toBeVisible();
  await simulatePayment(request, paymentId, { action: "succeed" });

  await expect(paymentRow(page, customerEmail)).toContainText("Succeeded");
});

test("PY-09.2 the live drawer shows ids, method, line items, timeline, redirect and notifications", async ({
  page,
  request,
}) => {
  await sendGatewayNotifications(request, "sslcommerz");
  const customerEmail = buildCustomerEmail("drawer");
  const paymentId = await createCheckout(request, customerEmail, {
    provider: "sslcommerz",
    currency: "BDT",
    amountMinor: 120_000,
    lineItems: [
      { name: "Live grocery order", quantity: 2, unit_amount_minor: 60_000 },
    ],
  });
  await payWithTestCard(request, paymentId);
  const failedApiCalls = watchFailedApiCalls(page);

  const paymentDrawer = await openPaymentDrawer(page, paymentId);

  const overview = paymentDrawer.getByRole("region", {
    name: "Payment overview",
  });
  await expect(overview).toContainText("SSLCommerz");
  await expect(overview).toContainText("tran_id");
  await expect(overview).toContainText(customerEmail);
  await expect(overview).toContainText(/ending 4242, expires 12\/34/);
  await expect(
    paymentDrawer.getByRole("region", { name: "Line items" }),
  ).toContainText("Live grocery order");
  await expect(
    paymentDrawer.getByRole("region", { name: "Timeline" }),
  ).toContainText("Redirected to the success URL");
  const redirects = paymentDrawer.getByRole("region", { name: "Redirects" });
  await expect(redirects).toContainText("Used, POST");
  await expect(
    redirects.getByRole("definition").filter({ hasText: /^VALID$/ }),
  ).toBeVisible();

  const notification = paymentDrawer
    .getByTestId("payment-notification")
    .filter({ hasText: "payment.succeeded" });
  await expect(notification).toHaveCount(1);
  await notification.click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=/);
  await expect(page.getByRole("dialog", { name: "Delivery" })).toContainText(
    "payment.succeeded",
  );
  expect(failedApiCalls).toEqual([]);
});
