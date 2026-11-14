import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RetryDelayChips } from "@/features/webhooks/endpoints/sheet/retry-delay-chips";
import type { WebhookEndpointFormValues } from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import {
  buildAttemptSchedule,
  formatScheduleSeconds,
} from "@/lib/webhooks/build-attempt-schedule";
import {
  maxAttemptLimits,
  type WebhookEndpointFieldErrors,
} from "@/lib/webhooks/validate-webhook-endpoint";

function AttemptSchedulePreview({
  formValues,
}: {
  formValues: WebhookEndpointFormValues;
}) {
  const maxAttempts = Number(formValues.maxAttempts);
  const isValidAttemptCount =
    Number.isInteger(maxAttempts) &&
    maxAttempts >= maxAttemptLimits.minimum &&
    maxAttempts <= maxAttemptLimits.maximum;
  if (!isValidAttemptCount) {
    return null;
  }

  const attemptStartsSeconds = buildAttemptSchedule({
    max_attempts: maxAttempts,
    backoff_seconds: formValues.backoffSeconds,
    retry_on_client_errors: formValues.retryOnClientErrors,
  });

  return (
    <p
      data-testid="attempt-schedule"
      className="rounded-md bg-muted/50 p-2.5 text-xs"
    >
      {maxAttempts === 1 ? "One attempt, no retries" : "Attempts at "}
      {maxAttempts > 1 &&
        attemptStartsSeconds.map(formatScheduleSeconds).join(", ")}
      .
    </p>
  );
}

/** Max attempts, the delay before each retry and whether 4xx retries. */
export function EndpointRetriesTab({
  formValues,
  fieldErrors,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  fieldErrors: WebhookEndpointFieldErrors;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <div className="grid gap-4">
      <FormField
        label="Max attempts"
        fieldId={`${fieldIdPrefix}-attempts`}
        hint="1 to 10, counting the first try."
        errorMessage={fieldErrors.retry_policy}
      >
        <Input
          id={`${fieldIdPrefix}-attempts`}
          inputMode="numeric"
          className="w-28"
          value={formValues.maxAttempts}
          aria-invalid={fieldErrors.retry_policy !== undefined}
          onChange={(changeEvent) => {
            onChange({ maxAttempts: changeEvent.target.value });
          }}
        />
      </FormField>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-delays`}>
          Delay before each retry
        </Label>
        <p className="text-xs text-muted-foreground">
          1 second to 24 hours, used in order; the last one repeats.
        </p>
        <RetryDelayChips
          inputId={`${fieldIdPrefix}-delays`}
          delaysSeconds={formValues.backoffSeconds}
          errorMessage={fieldErrors.backoff_seconds}
          onChange={(backoffSeconds) => {
            onChange({ backoffSeconds });
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="grid gap-0.5">
          <Label htmlFor={`${fieldIdPrefix}-client-errors`}>Retry on 4xx</Label>
          <p className="text-xs text-muted-foreground">
            5xx answers, timeouts and connection errors always retry.
          </p>
        </div>
        <Switch
          id={`${fieldIdPrefix}-client-errors`}
          checked={formValues.retryOnClientErrors}
          onCheckedChange={(retryOnClientErrors) => {
            onChange({ retryOnClientErrors });
          }}
        />
      </div>
      <AttemptSchedulePreview formValues={formValues} />
    </div>
  );
}
