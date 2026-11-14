import { expect, test } from "@playwright/test";

import type { AppStats } from "../../src/lib/api/types";
import { formatMinorAmount } from "../../src/lib/payments/format-money";
import { watchFailedApiCalls } from "./live-api-watch";

test("PY-09.5 the Overview's Payments tile shows the binary's payment count, success rate and revenue", async ({
  page,
  request,
}) => {
  const createResponse = await request.post("/api/v1/payments/checkout", {
    data: {
      provider: "stripe",
      amount_minor: 987_600,
      currency: "EUR",
      customer_email: "overview.tile@example.com",
    },
  });
  expect(createResponse.status()).toBe(201);
  const { id: paymentId } = (await createResponse.json()) as { id: string };
  const simulateResponse = await request.post(
    `/api/v1/payments/${paymentId}/simulate`,
    { data: { action: "succeed" } },
  );
  expect(simulateResponse.ok()).toBe(true);
  const appStats = (await (
    await request.get("/api/v1/stats")
  ).json()) as AppStats;
  expect(appStats.payments_today).toBeGreaterThanOrEqual(1);
  expect(appStats.payment_success_rate).not.toBeNull();
  const euroRevenue = appStats.payment_revenue.find(
    (revenue) => revenue.currency === "EUR",
  );
  expect(euroRevenue?.amount_minor ?? 0).toBeGreaterThanOrEqual(987_600);
  const largestRevenue = appStats.payment_revenue[0];
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/");
  const paymentsTile = page
    .getByRole("list", { name: "Totals" })
    .getByRole("link", { name: /^Payments/ });

  await expect(paymentsTile).toContainText(String(appStats.payment_count));
  await expect(paymentsTile).toContainText(
    `${appStats.payments_today} today, `,
  );
  await expect(paymentsTile).toContainText(/\d+% succeeded/);
  await expect(paymentsTile).toContainText(
    formatMinorAmount(
      largestRevenue.amount_minor,
      largestRevenue.currency,
      "en-US",
    ),
  );
  await expect(paymentsTile).toContainText("(test)");
  await paymentsTile.click();
  await expect(page).toHaveURL(/\/payments$/);
  await expect(
    page
      .getByTestId("payment-row")
      .filter({ hasText: "overview.tile@example.com" }),
  ).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});
