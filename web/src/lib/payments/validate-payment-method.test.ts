import { describe, expect, test } from "vitest";

import type { PaymentFlowStep, PaymentMethodInput } from "@/lib/api/types";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import { defaultTestCards } from "@/lib/payments/test-instruments";
import { validatePaymentMethod } from "@/lib/payments/validate-payment-method";

const walletSteps: PaymentFlowStep[] = [
  buildDefaultStep("account_number"),
  buildDefaultStep("otp"),
  buildDefaultStep("pin"),
];

const walletInput: PaymentMethodInput = {
  key: "upay",
  name: "Upay",
  flow: "wallet",
  accent: "#ffcc00",
  is_enabled: true,
  test_cards: [],
  test_numbers: [
    { number: "01660000001", outcome: "succeed", decline_reason: null },
  ],
  otp: "123456",
  pin: "1234",
  default_outcome: "succeed",
  test_account: "",
};

describe("validatePaymentMethod", () => {
  test("PY-12.1 accepts a new wallet method with test values", () => {
    expect(
      validatePaymentMethod(walletInput, [{ key: "bkash" }], true, walletSteps),
    ).toEqual({});
  });

  test("PY-12.1 names each problem: key, name, accent, numbers, OTP and PIN", () => {
    expect(
      validatePaymentMethod(
        {
          ...walletInput,
          key: "Bkash!",
          name: " ",
          accent: "red",
          test_numbers: [],
          otp: "1",
          pin: "x",
        },
        [],
        true,
        walletSteps,
      ),
    ).toEqual({
      key: "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
      name: "Enter a name",
      accent: "Use a colour like #e2136e",
      test_numbers: "Add at least one test value",
      otp: "Use 4 to 8 digits",
      pin: "Use 4 to 6 digits",
    });
    expect(
      validatePaymentMethod(
        { ...walletInput, key: "bkash" },
        [{ key: "bkash" }],
        true,
        walletSteps,
      ).key,
    ).toBe("A method with the key bkash already exists");
  });

  test("PY-01.1 a card method only takes numbers from the test ranges", () => {
    const cardInput = {
      ...walletInput,
      flow: "card",
      test_cards: defaultTestCards,
    };
    const cardSteps = [buildDefaultStep("card_form")];

    expect(validatePaymentMethod(cardInput, [], true, cardSteps)).toEqual({});
    expect(
      validatePaymentMethod(
        {
          ...cardInput,
          test_cards: [
            {
              number: "4111111111111111",
              outcome: "succeed",
              decline_reason: null,
            },
          ],
        },
        [],
        true,
        cardSteps,
      ).test_cards,
    ).toMatch(/is not a test card/);
  });

  test("PY-12.6 only the values the flow's steps read are checked", () => {
    const qrInput = {
      ...walletInput,
      flow: "qr",
      test_numbers: [],
      otp: "",
      pin: "",
    };

    expect(
      validatePaymentMethod(qrInput, [], true, [buildDefaultStep("qr_code")]),
    ).toEqual({});
    expect(
      validatePaymentMethod(qrInput, [], true, [
        buildDefaultStep("signed_in_account"),
      ]),
    ).toEqual({ test_account: "Enter the test account" });
  });

  test("PY-12.6 voucher codes take letters; wrong PIN needs a PIN step", () => {
    const voucherInput = {
      ...walletInput,
      flow: "voucher",
      test_numbers: [
        {
          number: "gift-0001",
          outcome: "succeed" as const,
          decline_reason: null,
        },
        {
          number: "GIFT0002",
          outcome: "wrong_pin" as const,
          decline_reason: null,
        },
      ],
    };

    expect(
      validatePaymentMethod(voucherInput, [], true, [
        buildDefaultStep("voucher_code"),
      ]).test_numbers,
    ).toBe("Wrong PIN needs a PIN step in the flow");
    expect(
      validatePaymentMethod(voucherInput, [], true, [
        buildDefaultStep("voucher_code"),
        buildDefaultStep("pin"),
      ]),
    ).toEqual({});
  });

  test("PY-12.6 a method needs a flow that exists", () => {
    expect(validatePaymentMethod(walletInput, [], true, undefined).flow).toBe(
      "Pick a flow",
    );
  });
});
