import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accentButtonClassName } from "@/features/checkout/flows/accent-button-classes";
import type { FlowProps } from "@/features/checkout/flows/flow-props";
import { describeTestOutcome } from "@/lib/payments/test-instruments";

type WalletStep = "number" | "otp" | "pin";

const stepOrder: WalletStep[] = ["number", "otp", "pin"];

/** The wallet flow: number, then OTP, then PIN, with the method's test values (PY-12.3). */
export function WalletFlow({
  paymentMethod,
  checkoutActions,
}: Omit<FlowProps, "checkoutSession">) {
  const fieldId = React.useId();
  const [walletStep, setWalletStep] = React.useState<WalletStep>("number");
  const [walletEntries, setWalletEntries] = React.useState({
    number: "",
    otp: "",
    pin: "",
  });
  const stepTexts: Record<
    WalletStep,
    { label: string; hint: string; button: string }
  > = {
    number: {
      label: `Your ${paymentMethod.name} account number`,
      hint: `Test wallets: ${paymentMethod.test_wallets.map((testWallet) => `${testWallet.number} (${describeTestOutcome(testWallet).toLowerCase()})`).join(", ")}`,
      button: "Confirm",
    },
    otp: {
      label: "Verification code",
      hint: `Test code: ${paymentMethod.otp}`,
      button: "Confirm",
    },
    pin: {
      label: "PIN",
      hint: `Test PIN: ${paymentMethod.pin}`,
      button: "Confirm and pay",
    },
  };
  const stepText = stepTexts[walletStep];

  return (
    <form
      noValidate
      aria-label={`${paymentMethod.name} payment`}
      className="grid gap-3"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        checkoutActions.showError(null);
        if (walletStep === "number") {
          const isTestWallet = paymentMethod.test_wallets.some(
            (testWallet) =>
              testWallet.number === walletEntries.number.replace(/\D/g, ""),
          );
          if (!isTestWallet) {
            checkoutActions.showError("Use a test wallet");
            return;
          }
        }
        const nextStep = stepOrder[stepOrder.indexOf(walletStep) + 1];
        if (nextStep !== undefined) {
          setWalletStep(nextStep);
          return;
        }
        checkoutActions.submit({
          action: "pay",
          method_key: paymentMethod.key,
          wallet: walletEntries,
        });
      }}
    >
      <p className="text-xs text-muted-foreground">
        Step {stepOrder.indexOf(walletStep) + 1} of {stepOrder.length}
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
