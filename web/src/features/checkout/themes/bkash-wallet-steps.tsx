import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accentButtonClassName } from "@/features/checkout/themes/accent-button-classes";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import {
  testWalletOtp,
  testWalletPin,
  testWallets,
} from "@/lib/payments/test-instruments";

type WalletStep = "number" | "otp" | "pin";

const stepTexts: Record<
  WalletStep,
  { label: string; hint: string; button: string }
> = {
  number: {
    label: "Your bKash account number",
    hint: `Test wallets: ${testWallets.map((testWallet) => `${testWallet.number} (${testWallet.label.toLowerCase()})`).join(", ")}`,
    button: "Confirm",
  },
  otp: {
    label: "Verification code",
    hint: `Test code: ${testWalletOtp}`,
    button: "Confirm",
  },
  pin: {
    label: "PIN",
    hint: `Test PIN: ${testWalletPin}`,
    button: "Confirm and pay",
  },
};

/** bKash's wallet flow: number, then the OTP, then the PIN (PY-03.2). */
export function BkashWalletSteps({
  checkoutActions,
}: {
  checkoutActions: CheckoutActions;
}) {
  const fieldId = React.useId();
  const [walletStep, setWalletStep] = React.useState<WalletStep>("number");
  const [walletEntries, setWalletEntries] = React.useState({
    number: "",
    otp: "",
    pin: "",
  });
  const stepText = stepTexts[walletStep];

  return (
    <form
      noValidate
      aria-label="bKash payment"
      className="grid gap-3"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        checkoutActions.showError(null);
        if (walletStep === "number") {
          const isTestWallet = testWallets.some(
            (testWallet) =>
              testWallet.number === walletEntries.number.replace(/\D/g, ""),
          );
          if (!isTestWallet) {
            checkoutActions.showError("Use a test wallet");
            return;
          }
          setWalletStep("otp");
          return;
        }
        if (walletStep === "otp") {
          setWalletStep("pin");
          return;
        }
        checkoutActions.submit({ action: "pay", wallet: walletEntries });
      }}
    >
      <p className="text-xs text-muted-foreground">
        Step {walletStep === "number" ? 1 : walletStep === "otp" ? 2 : 3} of 3
      </p>
      <FormField
        label={stepText.label}
        fieldId={`${fieldId}-${walletStep}`}
        hint={stepText.hint}
      >
        <Input
          key={walletStep}
          id={`${fieldId}-${walletStep}`}
          inputMode="numeric"
          autoComplete="off"
          type={walletStep === "pin" ? "password" : "text"}
          className="font-mono"
          autoFocus={walletStep !== "number"}
          value={walletEntries[walletStep]}
          onChange={(changeEvent) => {
            setWalletEntries((previousEntries) => ({
              ...previousEntries,
              [walletStep]: changeEvent.target.value,
            }));
          }}
        />
      </FormField>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        type="submit"
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
      >
        {stepText.button}
      </Button>
      {walletStep !== "number" && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            checkoutActions.showError(null);
            setWalletStep("number");
            setWalletEntries({
              number: walletEntries.number,
              otp: "",
              pin: "",
            });
          }}
        >
          Change number
        </Button>
      )}
    </form>
  );
}
