import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { buildLiveName, resetPaymentDefinition } from "./live-payments";

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

test.beforeEach(async ({ page, request }) => {
  await resetPaymentDefinition(request, "gateways", "sslcommerz");
  await page.goto("/payments/gateways");
  await expect(gatewayRow(page, "SSLCommerz")).toBeVisible();
});

test("PY-12.2 the live table lists every built-in gateway with the methods it offers", async ({
  page,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);

  for (const gatewayName of [
    "Stripe",
    "PayPal",
    "SSLCommerz",
    "bKash",
    "Native",
  ]) {
    await expect(gatewayRow(page, gatewayName)).toBeVisible();
  }
  await expect(gatewayRow(page, "SSLCommerz")).toContainText(
    "Card, bKash, Nagad, Rocket, DBBL Nexus, City Touch, BRAC iBanking",
  );
  await expect(
    page.getByRole("link", { name: "Gateways", exact: true }),
  ).toHaveAttribute("data-active", "true");
  expect(failedApiCalls).toEqual([]);
});

test("PY-12.2 a live built-in gateway is edited, previewed, shows Modified and is reset", async ({
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

  await page.reload();
  await openGateway(page, "SSLCommerz");
  await page.getByRole("tab", { name: "Notification" }).click();
  await expect(page.getByLabel("Event name for payment.succeeded")).toHaveValue(
    "VALIDATED",
  );
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset to default" })
    .click();
  await expect(gatewayRow(page, "SSLCommerz")).not.toContainText("Modified");
});

test("PY-12.2 live merchant secrets stay masked until a confirmed reveal", async ({
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

test("PY-12.2 a live custom gateway is added from blank, offers its methods and is deleted while unused", async ({
  page,
}) => {
  const gatewayName = buildLiveName("Live Nagad Pay");
  await page.getByRole("button", { name: "Add gateway" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a payment gateway" });
  await addDialog.getByLabel("Name").fill(gatewayName);
  await addDialog.getByRole("button", { name: "Add gateway" }).click();

  const gatewaySheet = page.getByRole("dialog", { name: gatewayName });
  await gatewaySheet.getByRole("tab", { name: "Checkout" }).click();
  await gatewaySheet.getByRole("button", { name: "Remove Card" }).click();
  await gatewaySheet.getByRole("combobox", { name: "Add a method" }).click();
  await page.getByRole("option", { name: "Nagad" }).click();
  await gatewaySheet.getByRole("button", { name: "Save gateway" }).click();
  await expect(gatewaySheet).toBeHidden();
  await expect(gatewayRow(page, gatewayName)).toContainText("Custom");
  await expect(gatewayRow(page, gatewayName)).toContainText("Nagad");

  await page.reload();
  await openGateway(page, gatewayName);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(gatewayRow(page, gatewayName)).toHaveCount(0);
});
