import { describe, expect, test } from "vitest";

import type { PaymentMethodInput } from "@/lib/api/types";
import { defaultTestCards } from "@/lib/payments/test-instruments";
import { validatePaymentMethod } from "@/lib/payments/validate-payment-method";

const walletInput: PaymentMethodInput = {
  key: "upay",
  name: "Upay",
  flow: "wallet",
  accent: "#ffcc00",
  is_enabled: true,
  test_cards: [],
  test_wallets: [
    { number: "01660000001", outcome: "succeed", decline_reason: null },
  ],
  otp: "123456",
  pin: "1234",
  bank_outcome: "succeed",
  test_account: "",
};

describe("validatePaymentMethod", () => {
  test("PY-12.1 accepts a new wallet method with test values", () => {
    expect(
      validatePaymentMethod(walletInput, [{ key: "bkash" }], true),
    ).toEqual({});
  });

  test("PY-12.1 names each problem: key, name, accent, wallets, OTP and PIN", () => {
    expect(
      validatePaymentMethod(
        {
          ...walletInput,
          key: "Bkash!",
          name: " ",
          accent: "red",
          test_wallets: [],
          otp: "1",
          pin: "x",
        },
        [],
        true,
      ),
    ).toEqual({
      key: "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
      name: "Enter a name",
      accent: "Use a colour like #e2136e",
      test_wallets: "Add at least one test wallet",
      otp: "Use 4 to 8 digits",
      pin: "Use 4 to 6 digits",
    });
    expect(
      validatePaymentMethod(
        { ...walletInput, key: "bkash" },
        [{ key: "bkash" }],
        true,
      ).key,
    ).toBe("A method with the key bkash already exists");
  });

  test("PY-01.1 a card method only takes numbers from the test ranges", () => {
    const cardInput = {
      ...walletInput,
      flow: "card" as const,
      test_cards: defaultTestCards,
    };

    expect(validatePaymentMethod(cardInput, [], true)).toEqual({});
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
      ).test_cards,
    ).toMatch(/is not a test card/);
  });
});
