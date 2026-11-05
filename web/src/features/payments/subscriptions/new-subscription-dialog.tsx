import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  readSubscriptionRequest,
  type SubscriptionFormValues,
  useSubscriptionForm,
} from "@/features/payments/subscriptions/use-subscription-form";
import { ApiError } from "@/lib/api/api-client";
import { usePaymentGateways } from "@/lib/api/hooks/use-payment-gateway-queries";
import { useCreatePaymentSubscription } from "@/lib/api/hooks/use-payment-subscription-queries";
import type { SubscriptionInterval } from "@/lib/api/types";

const intervals: SubscriptionInterval[] = ["day", "week", "month", "year"];

const textFields: {
  fieldName: keyof SubscriptionFormValues;
  label: string;
  inputMode?: "decimal" | "numeric" | "email";
}[] = [
  { fieldName: "customerEmail", label: "Customer email", inputMode: "email" },
  { fieldName: "planName", label: "Plan name" },
  { fieldName: "amountText", label: "Amount", inputMode: "decimal" },
  { fieldName: "currency", label: "Currency" },
  { fieldName: "trialDaysText", label: "Trial days", inputMode: "numeric" },
  { fieldName: "cardNumber", label: "Test card", inputMode: "numeric" },
];

/** Starts a subscription on a gateway; the test card pays each renewal (PY-07.4). */
export function NewSubscriptionDialog({ onClose }: { onClose: () => void }) {
  const fieldIdPrefix = React.useId();
  const gatewaysQuery = usePaymentGateways();
  const createSubscription = useCreatePaymentSubscription();
  const { formValues, formErrors, setFormErrors, changeValue } =
    useSubscriptionForm();
  const [requestError, setRequestError] = React.useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            const readResult = readSubscriptionRequest(formValues);
            if ("formErrors" in readResult) {
              setFormErrors(readResult.formErrors);
              return;
            }
            setFormErrors({});
            createSubscription.mutate(readResult.createRequest, {
              onSuccess: onClose,
              onError: (createError) => {
                setRequestError(
                  createError instanceof ApiError
                    ? createError.message
                    : "Could not start the subscription",
                );
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New subscription</DialogTitle>
            <DialogDescription>
              Without a trial the first period is charged at once.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Gateway" fieldId={`${fieldIdPrefix}-provider`}>
              <Select
                value={formValues.provider}
                onValueChange={(provider) => changeValue("provider", provider)}
              >
                <SelectTrigger
                  id={`${fieldIdPrefix}-provider`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(gatewaysQuery.data ?? []).map((paymentGateway) => (
                    <SelectItem
                      key={paymentGateway.key}
                      value={paymentGateway.key}
                    >
                      {paymentGateway.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Interval" fieldId={`${fieldIdPrefix}-interval`}>
              <Select
                value={formValues.interval}
                onValueChange={(interval) =>
                  changeValue("interval", interval as SubscriptionInterval)
                }
              >
                <SelectTrigger
                  id={`${fieldIdPrefix}-interval`}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervals.map((interval) => (
                    <SelectItem key={interval} value={interval}>
                      Every {interval}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {textFields.map((textField) => (
              <FormField
                key={textField.fieldName}
                label={textField.label}
                fieldId={`${fieldIdPrefix}-${textField.fieldName}`}
                errorMessage={formErrors[textField.fieldName]}
              >
                <Input
                  id={`${fieldIdPrefix}-${textField.fieldName}`}
                  inputMode={textField.inputMode}
                  value={formValues[textField.fieldName]}
                  aria-invalid={formErrors[textField.fieldName] !== undefined}
                  onChange={(changeEvent) =>
                    changeValue(textField.fieldName, changeEvent.target.value)
                  }
                />
              </FormField>
            ))}
          </div>
          {requestError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {requestError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubscription.isPending}>
              Start subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
