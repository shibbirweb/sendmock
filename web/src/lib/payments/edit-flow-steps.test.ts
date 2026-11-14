import { describe, expect, test } from "vitest";

import type { PaymentFlowStep } from "@/lib/api/types";
import {
  addFlowStep,
  moveFlowStep,
  removeFlowStep,
  updateFlowStep,
} from "@/lib/payments/edit-flow-steps";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";

const walletSteps: PaymentFlowStep[] = [
  buildDefaultStep("account_number"),
  buildDefaultStep("otp"),
  buildDefaultStep("pin"),
];

const stepTypesOf = (flowSteps: PaymentFlowStep[]) =>
  flowSteps.map((flowStep) => flowStep.type);

describe("editing flow steps one at a time", () => {
  test("PY-12.6 adds a step at the end or at a position, clamped to the flow", () => {
    expect(
      stepTypesOf(addFlowStep(walletSteps, buildDefaultStep("confirm"))),
    ).toEqual(["account_number", "otp", "pin", "confirm"]);
    expect(
      stepTypesOf(addFlowStep(walletSteps, buildDefaultStep("confirm"), 0)),
    ).toEqual(["confirm", "account_number", "otp", "pin"]);
    expect(
      stepTypesOf(addFlowStep(walletSteps, buildDefaultStep("confirm"), 99)),
    ).toEqual(["account_number", "otp", "pin", "confirm"]);
  });

  test("PY-12.6 moves and removes a step without changing the given list", () => {
    expect(stepTypesOf(moveFlowStep(walletSteps, 2, 0))).toEqual([
      "pin",
      "account_number",
      "otp",
    ]);
    expect(stepTypesOf(removeFlowStep(walletSteps, 1))).toEqual([
      "account_number",
      "pin",
    ]);
    expect(moveFlowStep(walletSteps, 7, 0)).toBe(walletSteps);
    expect(stepTypesOf(walletSteps)).toEqual(["account_number", "otp", "pin"]);
  });

  test("PY-12.6 relabels a step and moves it when a position is given", () => {
    const updatedSteps = updateFlowStep(walletSteps, 1, {
      field_label: "SMS code",
      position: 2,
    });

    expect(stepTypesOf(updatedSteps)).toEqual(["account_number", "pin", "otp"]);
    expect(updatedSteps[2]?.field_label).toBe("SMS code");
    expect(updatedSteps[2]?.button_label).toBe("Confirm");
  });
});
