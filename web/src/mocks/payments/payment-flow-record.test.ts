import { describe, expect, test } from "vitest";

import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  applyFlowInput,
  findFlowRecord,
  findShippedFlow,
  presentPaymentFlow,
} from "@/mocks/payments/payment-flow-record";

describe("payment flow records", () => {
  test("PY-12.6 a built-in shows its usage, and Modified once its steps change", () => {
    const mockDatabase = createMockDatabase("standard");
    const walletFlow = findFlowRecord(mockDatabase, "wallet");
    if (walletFlow === undefined) {
      throw new Error("The fixtures need the Wallet flow.");
    }
    expect(presentPaymentFlow(mockDatabase, walletFlow)).toMatchObject({
      is_modified: false,
      method_count: 3,
    });

    const editedFlow = applyFlowInput(walletFlow, {
      ...walletFlow,
      key: "renamed",
      steps: [...walletFlow.steps, buildDefaultStep("confirm")],
    });
    expect(editedFlow.key).toBe("wallet");
    expect(presentPaymentFlow(mockDatabase, editedFlow).is_modified).toBe(true);
    expect(findShippedFlow("wallet")?.steps).toHaveLength(3);
    expect(findShippedFlow("upay_qr")).toBeUndefined();
  });
});
