import { describe, expect, test } from "vitest";

import type { PaymentFlowStep } from "@/lib/api/types";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import { runPaymentFlow } from "@/lib/payments/run-payment-flow";
import { defaultTestCards } from "@/lib/payments/test-instruments";

const methodValues = {
  name: "Upay",
  test_cards: defaultTestCards,
  test_numbers: [
    {
      number: "01660000001",
      outcome: "succeed" as const,
      decline_reason: null,
    },
    {
      number: "01660000002",
      outcome: "decline" as const,
      decline_reason: "insufficient_funds" as const,
    },
    {
      number: "01660000003",
      outcome: "wrong_pin" as const,
      decline_reason: null,
    },
  ],
  otp: "123456",
  pin: "12121",
  default_outcome: "succeed" as const,
  test_account: "buyer@example.com",
};

const walletSteps: PaymentFlowStep[] = [
  buildDefaultStep("account_number"),
  buildDefaultStep("otp"),
  buildDefaultStep("pin"),
];

describe("runPaymentFlow", () => {
  test("PY-12.6 a wallet flow checks number, OTP and PIN in order; the number decides", () => {
    const payWallet = (walletNumber: string, otp: string, pin: string) =>
      runPaymentFlow(walletSteps, methodValues, {
        action: "pay",
        entries: { number: walletNumber, otp, pin },
      });

    expect(payWallet("01660000001", "123456", "12121")).toEqual({
      kind: "finished",
      outcome: { kind: "succeed" },
      paidWith: {
        kind: "wallet",
        wallet_name: "Upay",
        masked_number: "01660****01",
      },
    });
    expect(payWallet("01660000002", "123456", "12121")).toMatchObject({
      outcome: { kind: "decline", reason: "insufficient_funds" },
    });
    expect(payWallet("01999999999", "000000", "1")).toEqual({
      kind: "refused",
      message: "Use one of the test numbers",
    });
    expect(payWallet("01660000001", "000000", "12121")).toEqual({
      kind: "refused",
      message: "The verification code is wrong",
    });
    expect(payWallet("01660000003", "123456", "12121")).toEqual({
      kind: "refused",
      message: "Wrong PIN. Try again.",
    });
  });

  test("PY-01.1 a card form refuses real cards and follows the test card's outcome", () => {
    const payCard = (cardNumber: string) =>
      runPaymentFlow([buildDefaultStep("card_form")], methodValues, {
        action: "pay",
        card: {
          number: cardNumber,
          exp_month: 12,
          exp_year: 2034,
          cvc: "123",
          holder_name: "Test",
        },
      });

    expect(payCard("4111 1111 1111 1111")).toEqual({
      kind: "refused",
      message: "Use a test card: real card numbers are never accepted",
    });
    expect(payCard("4000002500003155")).toMatchObject({
      outcome: { kind: "three_ds" },
      paidWith: { kind: "card", last4: "3155" },
    });
  });

  test("PY-12.6 without a deciding step the method's default outcome decides", () => {
    const qrRun = runPaymentFlow([buildDefaultStep("qr_code")], methodValues, {
      action: "pay",
    });
    expect(qrRun).toEqual({
      kind: "finished",
      outcome: { kind: "succeed" },
      paidWith: { kind: "bank", bank_name: "Upay" },
    });

    expect(
      runPaymentFlow(
        [buildDefaultStep("signed_in_account")],
        { ...methodValues, default_outcome: "decline" },
        { action: "pay" },
      ),
    ).toMatchObject({
      outcome: { kind: "decline", reason: "generic_decline" },
      paidWith: { masked_number: "buyer@example.com" },
    });
  });

  test("PY-12.6 a voucher code matches in any case and is masked", () => {
    expect(
      runPaymentFlow(
        [buildDefaultStep("voucher_code")],
        {
          ...methodValues,
          test_numbers: [
            { number: "GIFT0001", outcome: "succeed", decline_reason: null },
          ],
        },
        { action: "pay", entries: { number: "gift-0001" } },
      ),
    ).toMatchObject({
      kind: "finished",
      paidWith: { masked_number: "****0001" },
    });
  });
});
