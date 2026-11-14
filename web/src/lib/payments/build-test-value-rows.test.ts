import { describe, expect, test } from "vitest";

import type {
  PaymentFlowDefinition,
  PaymentGatewayDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";
import { buildTestValueTables } from "@/lib/payments/build-test-value-rows";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import { defaultTestCards } from "@/lib/payments/test-instruments";

function buildFlow(
  flowKey: string,
  stepTypes: Parameters<typeof buildDefaultStep>[0][],
): PaymentFlowDefinition {
  return {
    key: flowKey,
    name: flowKey,
    picker_tab: flowKey,
    steps: stepTypes.map(buildDefaultStep),
    is_builtin: true,
    is_modified: false,
    method_count: 1,
  };
}

function buildMethod(
  methodFields: Partial<PaymentMethodDefinition> &
    Pick<PaymentMethodDefinition, "key" | "name" | "flow">,
): PaymentMethodDefinition {
  return {
    accent: "#000000",
    is_enabled: true,
    is_builtin: false,
    is_modified: false,
    test_cards: [],
    test_numbers: [],
    otp: "123456",
    pin: "12121",
    default_outcome: "succeed",
    test_account: "",
    gateway_keys: [],
    payment_count: 0,
    ...methodFields,
  };
}

const paymentFlows = [
  buildFlow("card", ["card_form"]),
  buildFlow("wallet", ["account_number", "otp", "pin"]),
  buildFlow("voucher", ["voucher_code"]),
  buildFlow("account", ["signed_in_account"]),
  buildFlow("qr", ["qr_code"]),
];

const nagadPay = {
  key: "nagad_pay",
  name: "Nagad Pay",
  method_keys: ["upay", "gift"],
} as PaymentGatewayDefinition;

describe("buildTestValueTables", () => {
  test("PY-09.4 values follow each method's flow, custom methods and gateways included", () => {
    const tables = buildTestValueTables(
      [
        buildMethod({
          key: "card",
          name: "Card",
          flow: "card",
          test_cards: defaultTestCards.slice(0, 1),
        }),
        buildMethod({
          key: "upay",
          name: "Upay",
          flow: "wallet",
          test_numbers: [
            { number: "01600000001", outcome: "succeed", decline_reason: null },
          ],
        }),
        buildMethod({
          key: "gift",
          name: "Gift card",
          flow: "voucher",
          test_numbers: [
            { number: "GIFT0001", outcome: "succeed", decline_reason: null },
          ],
        }),
        buildMethod({
          key: "paypal",
          name: "PayPal account",
          flow: "account",
          test_account: "buyer@example.com",
        }),
        buildMethod({
          key: "bank_qr",
          name: "Bank QR",
          flow: "qr",
          default_outcome: "decline",
        }),
        buildMethod({
          key: "off",
          name: "Off",
          flow: "card",
          is_enabled: false,
        }),
      ],
      paymentFlows,
      [nagadPay],
    );

    expect(tables.cardRows).toEqual([
      {
        methodName: "Card",
        offeredBy: "No gateway yet",
        testValue: "4242 4242 4242 4242",
        copyValue: "4242424242424242",
        outcome: "Succeeds",
        codes: "",
      },
    ]);
    expect(
      tables.numberRows.map((row) => [
        row.methodName,
        row.offeredBy,
        row.codes,
      ]),
    ).toEqual([
      ["Upay", "Nagad Pay", "OTP 123456, PIN 12121"],
      ["Gift card", "Nagad Pay", ""],
    ]);
    expect(
      tables.otherRows.map((row) => [row.methodName, row.outcome]),
    ).toEqual([
      ["PayPal account", "Signed in as buyer@example.com; always succeeds"],
      ["Bank QR", "Always declined"],
    ]);
  });

  test("PY-09.4 stored values a flow no longer asks for are not shown", () => {
    const tables = buildTestValueTables(
      [
        buildMethod({
          key: "card",
          name: "Card",
          flow: "qr",
          test_cards: defaultTestCards,
        }),
      ],
      paymentFlows,
      [],
    );

    expect(tables.cardRows).toEqual([]);
    expect(tables.otherRows.map((row) => row.outcome)).toEqual([
      "Always succeeds",
    ]);
  });
});
