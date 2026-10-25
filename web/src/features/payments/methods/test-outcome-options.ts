import type {
  DeclineReason,
  TestCardValue,
  TestWalletValue,
} from "@/lib/api/types";
import { declineReasons } from "@/lib/payments/payment-actions";

/** One select value per outcome; declines carry their reason, e.g. "decline:expired_card". */
export const cardOutcomeOptions = [
  { value: "succeed", label: "Succeeds" },
  { value: "three_ds", label: "Requires 3-D Secure" },
  { value: "succeed_then_dispute", label: "Succeeds, then a dispute opens" },
  ...declineReasons.map((declineReason) => ({
    value: `decline:${declineReason.reason}`,
    label: `Declined: ${declineReason.label.toLowerCase()}`,
  })),
];

export const walletOutcomeOptions = [
  { value: "succeed", label: "Succeeds" },
  {
    value: "decline:insufficient_funds",
    label: "Declined: insufficient balance",
  },
  { value: "wrong_pin", label: "Wrong PIN (asked again)" },
];

export function toOutcomeValue(
  testValue: TestCardValue | TestWalletValue,
): string {
  return testValue.outcome === "decline"
    ? `decline:${testValue.decline_reason ?? "generic_decline"}`
    : testValue.outcome;
}

/** The select value back to an outcome and reason. */
export function fromOutcomeValue(outcomeValue: string): {
  outcome: string;
  decline_reason: DeclineReason | null;
} {
  const [outcome = "succeed", declineReason] = outcomeValue.split(":");

  return {
    outcome,
    decline_reason: (declineReason as DeclineReason | undefined) ?? null,
  };
}
