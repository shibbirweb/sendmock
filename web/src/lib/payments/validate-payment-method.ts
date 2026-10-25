import type {
  PaymentMethodDefinition,
  PaymentMethodInput,
} from "@/lib/api/types";
import {
  isTestCardRange,
  passesLuhnCheck,
  toCardDigits,
} from "@/lib/payments/test-instruments";

export type PaymentMethodFieldErrors = Partial<
  Record<
    | "key"
    | "name"
    | "accent"
    | "test_cards"
    | "test_wallets"
    | "otp"
    | "pin"
    | "test_account",
    string
  >
>;

const methodKeyPattern = /^[a-z][a-z0-9_]{1,31}$/;

function findTestCardError(
  methodInput: PaymentMethodInput,
): string | undefined {
  if (methodInput.test_cards.length === 0) {
    return "Add at least one test card";
  }
  const cardNumbers = methodInput.test_cards.map((testCard) =>
    toCardDigits(testCard.number),
  );
  const badNumber = cardNumbers.find(
    (cardDigits) =>
      !passesLuhnCheck(cardDigits) || !isTestCardRange(cardDigits),
  );
  if (badNumber !== undefined) {
    return `${badNumber} is not a test card: use a number from the test ranges (4242 4242 4242..., 4000 00..., 4000 02..., 5555 5555 5555...) that passes the Luhn check`;
  }

  return new Set(cardNumbers).size === cardNumbers.length
    ? undefined
    : "Each test card number appears once";
}

function findTestWalletError(
  methodInput: PaymentMethodInput,
): string | undefined {
  const walletNumbers = methodInput.test_wallets.map(
    (testWallet) => testWallet.number,
  );
  if (walletNumbers.length === 0) {
    return "Add at least one test wallet";
  }
  if (walletNumbers.some((walletNumber) => !/^\d{8,15}$/.test(walletNumber))) {
    return "Wallet numbers are 8 to 15 digits";
  }

  return new Set(walletNumbers).size === walletNumbers.length
    ? undefined
    : "Each wallet number appears once";
}

/** Rules for a payment method, shared by the Methods screen and the API (PY-12.1). */
export function validatePaymentMethod(
  methodInput: PaymentMethodInput,
  existingMethods: Pick<PaymentMethodDefinition, "key">[],
  isNew: boolean,
): PaymentMethodFieldErrors {
  const fieldErrors: PaymentMethodFieldErrors = {};
  if (isNew && !methodKeyPattern.test(methodInput.key)) {
    fieldErrors.key =
      "Use 2 to 32 lowercase letters, digits or _, starting with a letter";
  } else if (
    isNew &&
    existingMethods.some(
      (existingMethod) => existingMethod.key === methodInput.key,
    )
  ) {
    fieldErrors.key = `A method with the key ${methodInput.key} already exists`;
  }
  if (methodInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (!/^#[0-9a-f]{6}$/i.test(methodInput.accent)) {
    fieldErrors.accent = "Use a colour like #e2136e";
  }
  if (methodInput.flow === "card") {
    fieldErrors.test_cards = findTestCardError(methodInput);
  }
  if (methodInput.flow === "wallet") {
    fieldErrors.test_wallets = findTestWalletError(methodInput);
    if (!/^\d{4,8}$/.test(methodInput.otp)) {
      fieldErrors.otp = "Use 4 to 8 digits";
    }
    if (!/^\d{4,6}$/.test(methodInput.pin)) {
      fieldErrors.pin = "Use 4 to 6 digits";
    }
  }
  if (
    methodInput.flow === "account" &&
    methodInput.test_account.trim() === ""
  ) {
    fieldErrors.test_account = "Enter the test account";
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      ([, fieldError]) => fieldError !== undefined,
    ),
  ) as PaymentMethodFieldErrors;
}
