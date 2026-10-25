import type {
  PaymentMethodDefinition,
  PaymentProvider,
  TestNumberValue,
} from "@/lib/api/types";
import { defaultTestCards } from "@/lib/payments/test-instruments";

/** What the mock stores; usage, gateways and Modified are worked out when presented. */
export type PaymentMethodRecord = Omit<
  PaymentMethodDefinition,
  "gateway_keys" | "payment_count" | "is_modified"
>;

function buildWallets(numberPrefix: string): TestNumberValue[] {
  return [
    { number: `${numberPrefix}1`, outcome: "succeed", decline_reason: null },
    {
      number: `${numberPrefix}2`,
      outcome: "decline",
      decline_reason: "insufficient_funds",
    },
    { number: `${numberPrefix}3`, outcome: "wrong_pin", decline_reason: null },
  ];
}

const emptyFlowValues = {
  test_cards: [],
  test_numbers: [],
  otp: "123456",
  pin: "12121",
  default_outcome: "succeed" as const,
  test_account: "",
};

function buildMethod(
  methodFields: Pick<PaymentMethodRecord, "key" | "name" | "flow" | "accent"> &
    Partial<PaymentMethodRecord>,
): PaymentMethodRecord {
  return {
    ...emptyFlowValues,
    is_enabled: true,
    is_builtin: true,
    ...methodFields,
  };
}

/** The shipped methods; a fresh copy each time, so Reset to default has an original (PY-12.1). */
export function buildBuiltinPaymentMethods(): PaymentMethodRecord[] {
  return [
    buildMethod({
      key: "card",
      name: "Card",
      flow: "card",
      accent: "#635bff",
      test_cards: defaultTestCards,
    }),
    buildMethod({
      key: "paypal_account",
      name: "PayPal account",
      flow: "account",
      accent: "#ffc439",
      test_account: "sb-buyer@personal.example.com",
    }),
    buildMethod({
      key: "bkash",
      name: "bKash",
      flow: "wallet",
      accent: "#e2136e",
      test_numbers: buildWallets("0177000000"),
    }),
    buildMethod({
      key: "nagad",
      name: "Nagad",
      flow: "wallet",
      accent: "#f6921e",
      test_numbers: buildWallets("0188000000"),
    }),
    buildMethod({
      key: "rocket",
      name: "Rocket",
      flow: "wallet",
      accent: "#8c3494",
      test_numbers: buildWallets("0199000000"),
    }),
    buildMethod({
      key: "dbbl",
      name: "DBBL Nexus",
      flow: "bank",
      accent: "#0b6e4f",
    }),
    buildMethod({
      key: "city",
      name: "City Touch",
      flow: "bank",
      accent: "#d71920",
    }),
    buildMethod({
      key: "brac",
      name: "BRAC iBanking",
      flow: "bank",
      accent: "#1f4e9c",
    }),
  ];
}

/** Which methods each built-in gateway's checkout offers, in order (until Gateways are editable). */
export const builtinGatewayMethodKeys: Record<PaymentProvider, string[]> = {
  stripe: ["card"],
  native: ["card"],
  paypal: ["paypal_account"],
  sslcommerz: ["card", "bkash", "nagad", "rocket", "dbbl", "city", "brac"],
  bkash: ["bkash"],
};

export const builtinGatewayAccents: Record<PaymentProvider, string> = {
  stripe: "#635bff",
  native: "#0d9488",
  paypal: "#ffc439",
  sslcommerz: "#1e5bb8",
  bkash: "#e2136e",
};
