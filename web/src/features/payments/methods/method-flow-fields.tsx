import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import {
  cardOutcomeOptions,
  listNumberOutcomeOptions,
} from "@/features/payments/methods/test-outcome-options";
import { TestValuesEditor } from "@/features/payments/methods/test-values-editor";
import type {
  PaymentFlowDefinition,
  PaymentMethodInput,
  PaymentStepType,
} from "@/lib/api/types";
import { findDecidingStep } from "@/lib/payments/payment-step-catalogue";
import type { PaymentMethodFieldErrors } from "@/lib/payments/validate-payment-method";

type FieldsProps = {
  methodInput: PaymentMethodInput;
  fieldErrors: PaymentMethodFieldErrors;
  onChange: (changedFields: Partial<PaymentMethodInput>) => void;
};

function CodeField({
  label,
  value,
  errorMessage,
  onChange,
}: {
  label: string;
  value: string;
  errorMessage: string | undefined;
  onChange: (nextValue: string) => void;
}) {
  const fieldId = React.useId();

  return (
    <FormField label={label} fieldId={fieldId} errorMessage={errorMessage}>
      <Input
        id={fieldId}
        inputMode="numeric"
        className="font-mono"
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
    </FormField>
  );
}

function TestAccountField({ methodInput, fieldErrors, onChange }: FieldsProps) {
  const fieldId = React.useId();

  return (
    <FormField
      label="Test account"
      fieldId={fieldId}
      hint="Shown as signed in on the checkout page."
      errorMessage={fieldErrors.test_account}
    >
      <Input
        id={fieldId}
        className="font-mono text-sm"
        value={methodInput.test_account}
        onChange={(changeEvent) =>
          onChange({ test_account: changeEvent.target.value })
        }
      />
    </FormField>
  );
}

function DefaultOutcomeField({ methodInput, onChange }: FieldsProps) {
  return (
    <RadioCardGroup<"succeed" | "decline">
      legend="Outcome"
      className="sm:grid-cols-2"
      selectedValue={methodInput.default_outcome}
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
      onSelect={(defaultOutcome) =>
        onChange({ default_outcome: defaultOutcome })
      }
    />
  );
}

/**
 * The test values a method's flow reads, one section per step that needs
 * them (PY-12.1, PY-12.6): test cards, test numbers or codes, OTP, PIN, the
 * test account, or the outcome when no step decides it.
 */
export function MethodFlowFields({
  paymentFlow,
  ...fieldsProps
}: FieldsProps & { paymentFlow: PaymentFlowDefinition | undefined }) {
  const { methodInput, fieldErrors, onChange } = fieldsProps;
  if (paymentFlow === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        This method&apos;s flow no longer exists, so it has no test values.
      </p>
    );
  }
  const stepTypes = paymentFlow.steps.map((flowStep) => flowStep.type);
  const hasStep = (stepType: PaymentStepType) => stepTypes.includes(stepType);
  const isVoucher = hasStep("voucher_code");

  return (
    <div className="grid gap-5">
      {hasStep("card_form") && (
        <TestValuesEditor
          legend="Test cards"
          rowLabel="Test card"
          numberPlaceholder="4000000000000077"
          testValues={methodInput.test_cards}
          outcomeOptions={cardOutcomeOptions}
          errorMessage={fieldErrors.test_cards}
          onChange={(testCards) => onChange({ test_cards: testCards })}
        />
      )}
      {(hasStep("account_number") || isVoucher) && (
        <TestValuesEditor
          legend={isVoucher ? "Test voucher codes" : "Test numbers"}
          rowLabel={isVoucher ? "Test code" : "Test number"}
          numberPlaceholder={isVoucher ? "GIFT0003" : "01600000004"}
          testValues={methodInput.test_numbers}
          outcomeOptions={listNumberOutcomeOptions(hasStep("pin"))}
          errorMessage={fieldErrors.test_numbers}
          onChange={(testNumbers) => onChange({ test_numbers: testNumbers })}
        />
      )}
      {(hasStep("otp") || hasStep("pin")) && (
        <div className="grid grid-cols-2 items-start gap-3">
          {hasStep("otp") && (
            <CodeField
              label="Test OTP"
              value={methodInput.otp}
              errorMessage={fieldErrors.otp}
              onChange={(otp) => onChange({ otp })}
            />
          )}
          {hasStep("pin") && (
            <CodeField
              label="Test PIN"
              value={methodInput.pin}
              errorMessage={fieldErrors.pin}
              onChange={(pin) => onChange({ pin })}
            />
          )}
        </div>
      )}
      {hasStep("signed_in_account") && <TestAccountField {...fieldsProps} />}
      {findDecidingStep(paymentFlow.steps) === undefined && (
        <DefaultOutcomeField {...fieldsProps} />
      )}
    </div>
  );
}
