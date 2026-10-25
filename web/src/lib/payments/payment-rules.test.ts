import { describe, expect, test } from "vitest";

import {
  formatMinorAmount,
  parseMajorAmount,
  readMinorUnitDigits,
} from "@/lib/payments/format-money";
import {
  listSimulateActions,
  readRefundableMinor,
  validateRefundAmount,
} from "@/lib/payments/payment-actions";
import { describePaymentStatus } from "@/lib/payments/payment-labels";

describe("money", () => {
  test("minor units follow the currency: two decimals, none for JPY", () => {
    expect(readMinorUnitDigits("USD")).toBe(2);
    expect(readMinorUnitDigits("JPY")).toBe(0);
    expect(formatMinorAmount(4900, "USD", "en-US")).toBe("$49.00");
    expect(formatMinorAmount(3000, "JPY", "en-US")).toBe("¥3,000");
    // Intl puts a non-breaking space after a currency code.
    expect(formatMinorAmount(125000, "BDT", "en-US").replace(/\s/g, " ")).toBe(
      "BDT 1,250.00",
    );
  });

  test("parses a typed amount into minor units, refusing extra decimals", () => {
    expect(parseMajorAmount("12.5", "USD")).toBe(1250);
    expect(parseMajorAmount("3000", "JPY")).toBe(3000);
    expect(parseMajorAmount("12.505", "USD")).toBeNull();
    expect(parseMajorAmount("30.5", "JPY")).toBeNull();
    expect(parseMajorAmount("abc", "USD")).toBeNull();
  });
});

describe("simulate actions", () => {
  test("PY-09.3 the menu offers only what the status allows", () => {
    expect(
      listSimulateActions({
        status: "requires_payment",
        checkout_url: "http://x/pay/1",
      }),
    ).toEqual(["succeed", "decline", "expire"]);
    expect(
      listSimulateActions({ status: "requires_action", checkout_url: null }),
    ).toEqual(["succeed", "decline"]);
    expect(
      listSimulateActions({ status: "authorized", checkout_url: null }),
    ).toEqual(["capture", "void"]);
    expect(
      listSimulateActions({ status: "succeeded", checkout_url: null }),
    ).toEqual(["refund", "dispute"]);
    expect(
      listSimulateActions({ status: "disputed", checkout_url: null }),
    ).toEqual(["resolve_dispute"]);
    expect(
      listSimulateActions({ status: "refunded", checkout_url: null }),
    ).toEqual([]);
  });

  test("PY-07.2 a refund is above zero and never more than is left", () => {
    const paidPayment = { captured_minor: 8000, refunded_minor: 3000 };

    expect(readRefundableMinor(paidPayment)).toBe(5000);
    expect(validateRefundAmount(5000, paidPayment)).toBeNull();
    expect(validateRefundAmount(5001, paidPayment)).toBe(
      "That is more than is left to refund",
    );
    expect(validateRefundAmount(0, paidPayment)).toBe(
      "Enter an amount above zero",
    );
    expect(validateRefundAmount(null, paidPayment)).toBe(
      "Enter an amount above zero",
    );
  });

  test("describes a failed status with its reason", () => {
    expect(
      describePaymentStatus({
        status: "failed",
        failure_code: "insufficient_funds",
      }),
    ).toBe("Failed: insufficient funds");
    expect(
      describePaymentStatus({ status: "succeeded", failure_code: null }),
    ).toBe("Succeeded");
  });
});
