import type {
  PaymentMethodDefinition,
  PaymentMethodFlow,
  PaymentMethodInput,
} from "@/lib/api/types";

export const methodFlowLabels: Record<
  PaymentMethodFlow,
  { label: string; description: string }
> = {
  card: {
    label: "Card",
    description: "Card form; the outcome follows its test cards.",
  },
  wallet: {
    label: "Wallet",
    description: "Wallet number, then OTP, then PIN.",
  },
  bank: { label: "Bank", description: "Pick the bank, then confirm." },
  account: {
    label: "Account",
    description: "Sign in as the test account, then approve.",
  },
};

/** How many test values a method has, for the table. */
export function countTestValues(
  paymentMethod: PaymentMethodDefinition,
): string {
  if (paymentMethod.flow === "card") {
    return `${paymentMethod.test_cards.length} test cards`;
  }
  if (paymentMethod.flow === "wallet") {
    return `${paymentMethod.test_wallets.length} test wallets`;
  }

  return paymentMethod.flow === "bank"
    ? `Always ${paymentMethod.bank_outcome === "decline" ? "declines" : "succeeds"}`
    : paymentMethod.test_account;
}

/** "Upay Wallet" as a key: "upay_wallet". */
export function toMethodKey(methodName: string): string {
  return methodName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "m_$1")
    .slice(0, 32);
}

/** A new method's starting values for its flow (PY-12.1). */
export function buildNewMethodInput(
  flow: PaymentMethodFlow,
  name: string,
  key: string,
): PaymentMethodInput {
  return {
    key,
    name,
    flow,
    accent: "#0d9488",
    is_enabled: true,
    test_cards:
      flow === "card"
        ? [
            {
              number: "4242424242424242",
              outcome: "succeed",
              decline_reason: null,
            },
            {
              number: "4000000000000002",
              outcome: "decline",
              decline_reason: "generic_decline",
            },
          ]
        : [],
    test_wallets:
      flow === "wallet"
        ? [
            { number: "01600000001", outcome: "succeed", decline_reason: null },
            {
              number: "01600000002",
              outcome: "decline",
              decline_reason: "insufficient_funds",
            },
            {
              number: "01600000003",
              outcome: "wrong_pin",
              decline_reason: null,
            },
          ]
        : [],
    otp: "123456",
    pin: "12121",
    bank_outcome: "succeed",
    test_account: flow === "account" ? "test-buyer@example.com" : "",
  };
}
