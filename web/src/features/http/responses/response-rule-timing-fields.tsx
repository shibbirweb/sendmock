import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResponseRuleFormValues } from "@/features/http/responses/use-response-rule-form";
import type { ResponseRuleFieldErrors } from "@/lib/http/validate-response-rule";

function NumberInput({
  inputId,
  ariaLabel,
  value,
  isInvalid,
  onChange,
}: {
  inputId: string;
  ariaLabel?: string;
  value: string;
  isInvalid: boolean;
  onChange: (nextValue: string) => void;
}) {
  return (
    <Input
      id={inputId}
      aria-label={ariaLabel}
      inputMode="numeric"
      className="w-24 font-mono"
      value={value}
      aria-invalid={isInvalid}
      onChange={(changeEvent) => {
        onChange(changeEvent.target.value);
      }}
    />
  );
}

/** Delay range and failure rate, to test timeouts and retries (HC-02.3). */
export function ResponseRuleTimingFields({
  formValues,
  fieldErrors,
  onChange,
}: {
  formValues: ResponseRuleFormValues;
  fieldErrors: ResponseRuleFieldErrors;
  onChange: (changedValues: Partial<ResponseRuleFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-sm font-semibold">
        Timing and failures
      </legend>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-delay-min`}>Delay (ms)</Label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NumberInput
            inputId={`${fieldIdPrefix}-delay-min`}
            value={formValues.delayMinMs}
            isInvalid={fieldErrors.delay !== undefined}
            onChange={(delayMinMs) => {
              onChange({ delayMinMs });
            }}
          />
          to
          <NumberInput
            inputId={`${fieldIdPrefix}-delay-max`}
            ariaLabel="Longest delay (ms)"
            value={formValues.delayMaxMs}
            isInvalid={fieldErrors.delay !== undefined}
            onChange={(delayMaxMs) => {
              onChange({ delayMaxMs });
            }}
          />
          <span className="text-xs text-muted-foreground">
            The same number twice is a fixed delay.
          </span>
        </div>
        <FormFieldError errorMessage={fieldErrors.delay} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-failure-rate`}>
          Failure rate (%)
        </Label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NumberInput
            inputId={`${fieldIdPrefix}-failure-rate`}
            value={formValues.failureRatePercent}
            isInvalid={fieldErrors.failure !== undefined}
            onChange={(failureRatePercent) => {
              onChange({ failureRatePercent });
            }}
          />
          answered with
          <NumberInput
            inputId={`${fieldIdPrefix}-failure-status`}
            ariaLabel="Failure status code"
            value={formValues.failureStatusCode}
            isInvalid={fieldErrors.failure !== undefined}
            onChange={(failureStatusCode) => {
              onChange({ failureStatusCode });
            }}
          />
        </div>
        <FormFieldError errorMessage={fieldErrors.failure} />
      </div>
    </fieldset>
  );
}
