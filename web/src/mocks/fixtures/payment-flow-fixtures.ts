import type {
  PaymentFlowDefinition,
  PaymentFlowStep,
  PaymentStepType,
} from "@/lib/api/types";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";

/** What the mock stores; Modified and usage are worked out when presented. */
export type PaymentFlowRecord = Omit<
  PaymentFlowDefinition,
  "is_modified" | "method_count"
>;

function buildStep(
  stepType: PaymentStepType,
  labelChanges: Partial<Omit<PaymentFlowStep, "type">> = {},
): PaymentFlowStep {
  return { ...buildDefaultStep(stepType), ...labelChanges };
}

/** The shipped flows; a fresh copy each time, so Reset to default has an original (PY-12.6). */
export function buildBuiltinPaymentFlows(): PaymentFlowRecord[] {
  return [
    {
      key: "card",
      name: "Card",
      picker_tab: "Cards",
      steps: [buildStep("card_form")],
      is_builtin: true,
    },
    {
      key: "wallet",
      name: "Wallet",
      picker_tab: "Mobile banking",
      steps: [buildStep("account_number"), buildStep("otp"), buildStep("pin")],
      is_builtin: true,
    },
    {
      key: "bank",
      name: "Bank",
      picker_tab: "Net banking",
      steps: [buildStep("confirm")],
      is_builtin: true,
    },
    {
      key: "account",
      name: "Account",
      picker_tab: "Accounts",
      steps: [buildStep("signed_in_account")],
      is_builtin: true,
    },
    {
      key: "qr",
      name: "QR",
      picker_tab: "Scan to pay",
      steps: [buildStep("qr_code")],
      is_builtin: true,
    },
    {
      key: "bank_transfer",
      name: "Bank transfer",
      picker_tab: "Bank transfer",
      steps: [buildStep("reference_code")],
      is_builtin: true,
    },
    {
      key: "voucher",
      name: "Voucher",
      picker_tab: "Vouchers",
      steps: [buildStep("voucher_code")],
      is_builtin: true,
    },
  ];
}
