import { describe, expect, test } from "vitest";

import type { PaymentFlowInput } from "@/lib/api/types";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import { validatePaymentFlow } from "@/lib/payments/validate-payment-flow";

const qrInput: PaymentFlowInput = {
  key: "upay_qr",
  name: "Upay QR",
  picker_tab: "Scan to pay",
  steps: [buildDefaultStep("qr_code")],
};

describe("validatePaymentFlow", () => {
  test("PY-12.6 accepts a new flow with one step", () => {
    expect(validatePaymentFlow(qrInput, [{ key: "wallet" }], true)).toEqual({});
  });

  test("PY-12.6 names each problem: key, name, picker tab and steps", () => {
    expect(
      validatePaymentFlow(
        { key: "Upay QR", name: "", picker_tab: " ", steps: [] },
        [],
        true,
      ),
    ).toEqual({
      key: "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
      name: "Enter a name",
      picker_tab: "Enter the picker tab, e.g. Mobile banking",
      steps: "Add at least one step",
    });
    expect(
      validatePaymentFlow(
        { ...qrInput, key: "wallet" },
        [{ key: "wallet" }],
        true,
      ).key,
    ).toBe("A flow with the key wallet already exists");
  });

  test("PY-12.6 allows one deciding step, each step type once and at most six steps", () => {
    const stepsError = (stepTypes: PaymentFlowInput["steps"]) =>
      validatePaymentFlow({ ...qrInput, steps: stepTypes }, [], false).steps;

    expect(
      stepsError([
        buildDefaultStep("card_form"),
        buildDefaultStep("voucher_code"),
      ]),
    ).toBe(
      "Use one deciding step at most (card form, account number or voucher code)",
    );
    expect(stepsError([buildDefaultStep("otp"), buildDefaultStep("otp")])).toBe(
      "Each step type appears once",
    );
    expect(
      stepsError(
        (
          [
            "otp",
            "pin",
            "confirm",
            "qr_code",
            "reference_code",
            "signed_in_account",
            "card_form",
          ] as const
        ).map(buildDefaultStep),
      ),
    ).toBe("A flow has at most 6 steps");
  });

  test("PY-12.6 each step needs its button text, and a field label when it has a field", () => {
    expect(
      validatePaymentFlow(
        {
          ...qrInput,
          steps: [
            { ...buildDefaultStep("otp"), field_label: "" },
            {
              ...buildDefaultStep("qr_code"),
              field_label: "",
              button_label: " ",
            },
          ],
        },
        [],
        false,
      ),
    ).toEqual({
      "steps.0": "Enter the field label",
      "steps.1": "Enter the button text",
    });
  });

  test("PY-12.6 a step type SendMock does not know is refused", () => {
    expect(
      validatePaymentFlow(
        {
          ...qrInput,
          steps: [{ ...buildDefaultStep("otp"), type: "face_id" as "otp" }],
        },
        [],
        false,
      ).steps,
    ).toBe("face_id is not a step type SendMock knows");
  });
});
