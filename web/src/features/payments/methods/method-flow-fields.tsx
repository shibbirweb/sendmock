import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import {
  cardOutcomeOptions,
  walletOutcomeOptions,
} from "@/features/payments/methods/test-outcome-options";
import { TestValuesEditor } from "@/features/payments/methods/test-values-editor";
import type { PaymentMethodInput } from "@/lib/api/types";
import type { PaymentMethodFieldErrors } from "@/lib/payments/validate-payment-method";

/** The test values a flow needs: cards, wallets with OTP and PIN, a bank outcome or an account (PY-12.1). */
export function MethodFlowFields({
  methodInput,
  fieldErrors,
  onChange,
}: {
  methodInput: PaymentMethodInput;
  fieldErrors: PaymentMethodFieldErrors;
  onChange: (changedFields: Partial<PaymentMethodInput>) => void;
}) {
  const fieldIdPrefix = React.useId();
  if (methodInput.flow === "card") {
    return (
      <TestValuesEditor
        legend="Test cards"
        rowLabel="Test card"
        numberPlaceholder="4000000000000077"
        testValues={methodInput.test_cards}
        outcomeOptions={cardOutcomeOptions}
        errorMessage={fieldErrors.test_cards}
        onChange={(testCards) => {
          onChange({ test_cards: testCards });
        }}
      />
    );
  }
  if (methodInput.flow === "wallet") {
    return (
      <div className="grid gap-4">
        <TestValuesEditor
          legend="Test wallets"
          rowLabel="Test wallet"
          numberPlaceholder="01600000001"
          testValues={methodInput.test_wallets}
          outcomeOptions={walletOutcomeOptions}
          errorMessage={fieldErrors.test_wallets}
          onChange={(testWallets) => {
            onChange({ test_wallets: testWallets });
          }}
        />
        <div className="grid grid-cols-2 items-start gap-3">
          <FormField
            label="Test OTP"
            fieldId={`${fieldIdPrefix}-otp`}
            errorMessage={fieldErrors.otp}
          >
            <Input
              id={`${fieldIdPrefix}-otp`}
              inputMode="numeric"
              className="font-mono"
              value={methodInput.otp}
              onChange={(changeEvent) =>
                onChange({ otp: changeEvent.target.value })
              }
            />
          </FormField>
          <FormField
            label="Test PIN"
            fieldId={`${fieldIdPrefix}-pin`}
            errorMessage={fieldErrors.pin}
          >
            <Input
              id={`${fieldIdPrefix}-pin`}
              inputMode="numeric"
              className="font-mono"
              value={methodInput.pin}
              onChange={(changeEvent) =>
                onChange({ pin: changeEvent.target.value })
              }
            />
          </FormField>
        </div>
      </div>
    );
  }
  if (methodInput.flow === "bank") {
    return (
      <RadioCardGroup<"succeed" | "decline">
        legend="Outcome"
        className="sm:grid-cols-2"
        selectedValue={methodInput.bank_outcome}
        options={[
          {
            value: "succeed",
            label: "Succeeds",
            description: "Every payment goes through.",
          },
          {
            value: "decline",
            label: "Declined",
            description: "Every payment is declined.",
          },
        ]}
        onSelect={(bankOutcome) => onChange({ bank_outcome: bankOutcome })}
      />
    );
  }

  return (
    <FormField
      label="Test account"
      fieldId={`${fieldIdPrefix}-account`}
      hint="Shown as signed in on the checkout page."
      errorMessage={fieldErrors.test_account}
    >
      <Input
        id={`${fieldIdPrefix}-account`}
        className="font-mono text-sm"
        value={methodInput.test_account}
        onChange={(changeEvent) =>
          onChange({ test_account: changeEvent.target.value })
        }
      />
    </FormField>
  );
}
