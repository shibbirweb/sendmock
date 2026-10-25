import type { DeclineReason } from "@/lib/api/types";

export type TestCardOutcome =
  | { kind: "succeed" }
  | { kind: "decline"; reason: DeclineReason }
  | { kind: "three_ds" }
  | { kind: "succeed_then_dispute" };

/** Stripe's documented test cards, used by every card provider (17-payments). */
export const testCards: {
  number: string;
  label: string;
  outcome: TestCardOutcome;
}[] = [
  {
    number: "4242424242424242",
    label: "Succeeds (Visa)",
    outcome: { kind: "succeed" },
  },
  {
    number: "5555555555554444",
    label: "Succeeds (Mastercard)",
    outcome: { kind: "succeed" },
  },
  {
    number: "4000000000000002",
    label: "Declined: generic decline",
    outcome: { kind: "decline", reason: "generic_decline" },
  },
  {
    number: "4000000000009995",
    label: "Declined: insufficient funds",
    outcome: { kind: "decline", reason: "insufficient_funds" },
  },
  {
    number: "4000000000000069",
    label: "Declined: expired card",
    outcome: { kind: "decline", reason: "expired_card" },
  },
  {
    number: "4000000000000127",
    label: "Declined: incorrect CVC",
    outcome: { kind: "decline", reason: "incorrect_cvc" },
  },
  {
    number: "4000002500003155",
    label: "Requires 3-D Secure",
    outcome: { kind: "three_ds" },
  },
  {
    number: "4000000000000259",
    label: "Succeeds, then a dispute opens",
    outcome: { kind: "succeed_then_dispute" },
  },
];

export const testWalletOtp = "123456";
export const testWalletPin = "12121";

export type TestWalletOutcome =
  | { kind: "succeed" }
  | { kind: "decline"; reason: DeclineReason }
  | { kind: "wrong_pin" };

export const testWallets: {
  number: string;
  label: string;
  outcome: TestWalletOutcome;
}[] = [
  { number: "01770000001", label: "Succeeds", outcome: { kind: "succeed" } },
  {
    number: "01770000002",
    label: "Declined: insufficient balance",
    outcome: { kind: "decline", reason: "insufficient_funds" },
  },
  {
    number: "01770000003",
    label: "Wrong PIN (asked again)",
    outcome: { kind: "wrong_pin" },
  },
];

/** Digits only, so "4242 4242 ..." and "4242-4242-..." match the table. */
export function toCardDigits(cardNumber: string): string {
  return cardNumber.replace(/[\s-]/g, "");
}

/** The Luhn checksum every real card number passes. */
export function passesLuhnCheck(cardDigits: string): boolean {
  if (!/^\d{12,19}$/.test(cardDigits)) {
    return false;
  }
  const digitSum = [...cardDigits]
    .reverse()
    .reduce((runningSum, digitText, digitIndex) => {
      const digitValue = Number(digitText);
      const weightedDigit = digitIndex % 2 === 1 ? digitValue * 2 : digitValue;
      return (
        runningSum + (weightedDigit > 9 ? weightedDigit - 9 : weightedDigit)
      );
    }, 0);

  return digitSum % 10 === 0;
}

export type CardCheck =
  | { kind: "invalid" }
  | { kind: "not_test_card" }
  | { kind: "test_card"; outcome: TestCardOutcome };

/**
 * A typed card number against the test card table (PY-01.1): a number that
 * passes the Luhn check but is not a test card is refused, never used.
 */
export function checkCardNumber(cardNumber: string): CardCheck {
  const cardDigits = toCardDigits(cardNumber);
  const testCard = testCards.find(
    (candidateCard) => candidateCard.number === cardDigits,
  );
  if (testCard !== undefined) {
    return { kind: "test_card", outcome: testCard.outcome };
  }

  return passesLuhnCheck(cardDigits)
    ? { kind: "not_test_card" }
    : { kind: "invalid" };
}

export function readCardBrand(cardDigits: string): string {
  if (cardDigits.startsWith("4")) {
    return "visa";
  }
  if (/^5[1-5]/.test(cardDigits)) {
    return "mastercard";
  }

  return /^3[47]/.test(cardDigits) ? "amex" : "card";
}

/** A wallet number, OTP and PIN against the test wallets (17-payments). */
export function checkWallet(
  walletNumber: string,
  otp: string,
  pin: string,
): TestWalletOutcome | { kind: "error"; message: string } {
  const testWallet = testWallets.find(
    (candidateWallet) =>
      candidateWallet.number === walletNumber.replace(/\D/g, ""),
  );
  if (testWallet === undefined) {
    return { kind: "error", message: "Use a test wallet" };
  }
  if (otp !== testWalletOtp) {
    return { kind: "error", message: "The verification code is wrong" };
  }
  if (testWallet.outcome.kind === "wrong_pin" || pin !== testWalletPin) {
    return { kind: "wrong_pin" };
  }

  return testWallet.outcome;
}
