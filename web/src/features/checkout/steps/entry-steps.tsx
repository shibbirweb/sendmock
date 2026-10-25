import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import type {
  CheckoutStepView,
  FlowEntries,
  StepViewProps,
} from "@/features/checkout/steps/step-view-props";
import {
  describeTestOutcome,
  findTestNumber,
} from "@/lib/payments/test-instruments";

type EntryKey = "number" | "otp" | "pin";

/** One input step: its label and hint come from the flow, the test values line from the method. */
function EntryField({
  flowStep,
  flowEntries,
  onEntriesChange,
  isFirstStep,
  entryKey,
  testValuesText,
  isSecret = false,
  isNumeric = true,
}: StepViewProps & {
  entryKey: EntryKey;
  testValuesText: string;
  isSecret?: boolean;
  isNumeric?: boolean;
}) {
  const fieldId = React.useId();
  const hintText = [flowStep.hint, testValuesText]
    .filter((hintPart) => hintPart !== "")
    .join(" ");

  return (
    <FormField label={flowStep.field_label} fieldId={fieldId} hint={hintText}>
      <Input
        id={fieldId}
        inputMode={isNumeric ? "numeric" : undefined}
        autoComplete="off"
        type={isSecret ? "password" : "text"}
        className="font-mono"
        autoFocus={!isFirstStep}
        value={flowEntries[entryKey]}
        onChange={(changeEvent) => {
          onEntriesChange({
            [entryKey]: changeEvent.target.value,
          } as Partial<FlowEntries>);
        }}
      />
    </FormField>
  );
}

function describeTestNumbers(
  stepViewProps: StepViewProps,
  valuesLabel: string,
): string {
  const testNumbers = stepViewProps.paymentMethod.test_numbers.map(
    (testNumber) =>
      `${testNumber.number} (${describeTestOutcome(testNumber).toLowerCase()})`,
  );

  return `${valuesLabel}: ${testNumbers.join(", ")}`;
}

function findUnknownNumber(
  flowEntries: FlowEntries,
  testNumbers: StepViewProps["paymentMethod"]["test_numbers"],
  unknownMessage: string,
): string | null {
  return findTestNumber(testNumbers, flowEntries.number) === undefined
    ? unknownMessage
    : null;
}

/** An account, wallet or phone number checked against the method's test numbers (PY-12.6). */
export const accountNumberStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <EntryField
      {...stepViewProps}
      entryKey="number"
      testValuesText={describeTestNumbers(stepViewProps, "Test numbers")}
    />
  ),
  findEntryError: (paymentMethod, flowEntries) =>
    findUnknownNumber(
      flowEntries,
      paymentMethod.test_numbers,
      "Use one of the test numbers",
    ),
};

/** A voucher or gift card code checked against the method's test codes (PY-12.6). */
export const voucherCodeStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <EntryField
      {...stepViewProps}
      entryKey="number"
      isNumeric={false}
      testValuesText={describeTestNumbers(stepViewProps, "Test codes")}
    />
  ),
  findEntryError: (paymentMethod, flowEntries) =>
    findUnknownNumber(
      flowEntries,
      paymentMethod.test_numbers,
      "Use one of the test voucher codes",
    ),
};

/** The verification code; it is checked with the PIN when the flow is paid. */
export const otpStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <EntryField
      {...stepViewProps}
      entryKey="otp"
      testValuesText={`Test code: ${stepViewProps.paymentMethod.otp}`}
    />
  ),
  findEntryError: (_paymentMethod, flowEntries) =>
    flowEntries.otp.trim() === "" ? "Enter the verification code" : null,
};

/** The PIN; a wrong one is asked again (PY-03.2). */
export const pinStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <EntryField
      {...stepViewProps}
      entryKey="pin"
      isSecret
      testValuesText={`Test PIN: ${stepViewProps.paymentMethod.pin}`}
    />
  ),
  findEntryError: (_paymentMethod, flowEntries) =>
    flowEntries.pin.trim() === "" ? "Enter the PIN" : null,
};
