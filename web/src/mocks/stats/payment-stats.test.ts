import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { calculatePaymentStats } from "@/mocks/stats/payment-stats";

describe("payment stats", () => {
  test("PY-09.5 counts payments, today's, the success rate and net revenue per currency", () => {
    const mockDatabase = createMockDatabase("standard");
    const payments = mockDatabase.payments;
    const paymentStats = calculatePaymentStats(payments, 0);

    expect(paymentStats.payment_count).toBe(payments.length);
    expect(paymentStats.payments_today).toBe(payments.length);
    expect(paymentStats.payment_success_rate).toBeGreaterThan(0);
    expect(paymentStats.payment_success_rate).toBeLessThan(1);
    const revenueAmounts = paymentStats.payment_revenue.map(
      (revenue) => revenue.amount_minor,
    );
    expect(revenueAmounts).toEqual(
      [...revenueAmounts].sort((first, second) => second - first),
    );
    const expectedUsd = payments
      .filter((payment) => payment.currency === "USD")
      .reduce(
        (runningTotal, payment) =>
          runningTotal +
          Math.max(payment.captured_minor - payment.refunded_minor, 0),
        0,
      );
    expect(
      paymentStats.payment_revenue.find((revenue) => revenue.currency === "USD")
        ?.amount_minor ?? 0,
    ).toBe(expectedUsd);
  });

  test("PY-09.5 no finished payment gives no success rate", () => {
    expect(calculatePaymentStats([], 0)).toEqual({
      payment_count: 0,
      payments_today: 0,
      payment_success_rate: null,
      payment_revenue: [],
    });
  });
});
