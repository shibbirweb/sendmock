import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  applyMethodInput,
  findShippedMethod,
  listGatewayMethods,
  presentPaymentMethod,
} from "@/mocks/payments/payment-method-record";

describe("payment method records", () => {
  test("PY-12.1 a built-in shows its gateways and usage, and Modified once edited", () => {
    const mockDatabase = createMockDatabase("standard");
    const bkashMethod = mockDatabase.paymentMethods.find(
      (method) => method.key === "bkash",
    );
    if (bkashMethod === undefined) {
      throw new Error("The fixtures need the bKash method.");
    }

    const shippedView = presentPaymentMethod(mockDatabase, bkashMethod);
    expect(shippedView).toMatchObject({
      is_modified: false,
      gateway_keys: ["sslcommerz", "bkash"],
    });
    expect(shippedView.payment_count).toBeGreaterThan(0);

    const editedMethod = applyMethodInput(bkashMethod, {
      ...shippedView,
      otp: "654321",
    });
    expect(presentPaymentMethod(mockDatabase, editedMethod).is_modified).toBe(
      true,
    );
    expect(findShippedMethod("bkash")?.otp).toBe("123456");
    expect(findShippedMethod("upay")).toBeUndefined();
  });

  test("PY-12.3 a gateway offers its enabled methods in order", () => {
    const mockDatabase = createMockDatabase("standard");
    const nagadMethod = mockDatabase.paymentMethods.find(
      (method) => method.key === "nagad",
    );
    if (nagadMethod === undefined) {
      throw new Error("The fixtures need the Nagad method.");
    }
    nagadMethod.is_enabled = false;

    expect(
      listGatewayMethods(mockDatabase, "sslcommerz").map(
        (method) => method.key,
      ),
    ).toEqual(["card", "bkash", "rocket", "dbbl", "city", "brac"]);
    expect(
      listGatewayMethods(mockDatabase, "paypal").map((method) => method.key),
    ).toEqual(["paypal_account"]);
  });
});
