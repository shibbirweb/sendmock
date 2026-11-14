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
  type NewPaymentFormValues,
  readNewPaymentRequest,
  useNewPaymentForm,
} from "@/features/payments/new-payment/use-new-payment-form";
import { ApiError } from "@/lib/api/api-client";
import { usePaymentGateways } from "@/lib/api/hooks/use-payment-gateway-queries";
import { useCreatePayment } from "@/lib/api/hooks/use-payment-queries";
import type { PaymentCaptureMethod } from "@/lib/api/types";

const captureLabels: Record<PaymentCaptureMethod, string> = {
  automatic: "Capture at once",
  manual: "Authorize only",
};

const textFields: {
  fieldName: keyof NewPaymentFormValues;
  label: string;
  inputMode?: "decimal" | "numeric" | "email";
}[] = [
  { fieldName: "amountText", label: "Amount", inputMode: "decimal" },
  { fieldName: "currency", label: "Currency" },
  { fieldName: "cardNumber", label: "Test card", inputMode: "numeric" },
  { fieldName: "customerEmail", label: "Customer email", inputMode: "email" },
];

type SelectFieldProps = {
  label: string;
  fieldId: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (selectedValue: string) => void;
};

function SelectField({
  label,
  fieldId,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <FormField label={label} fieldId={fieldId}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/** Pays with a test card as an app's server does, without a checkout page (PY-02.1). */
export function NewPaymentDialog({ onClose }: { onClose: () => void }) {
  const fieldIdPrefix = React.useId();
  const gatewaysQuery = usePaymentGateways();
  const createPayment = useCreatePayment();
  const { formValues, formErrors, setFormErrors, changeValue } =
    useNewPaymentForm();
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const submitPayment = (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const readResult = readNewPaymentRequest(formValues);
    if ("formErrors" in readResult) {
      setFormErrors(readResult.formErrors);
      return;
    }
    setFormErrors({});
    createPayment.mutate(readResult.createRequest, {
      onSuccess: onClose,
      onError: (createError) => {
        setRequestError(
          createError instanceof ApiError
            ? createError.message
            : "Could not create the payment",
        );
      },
    });
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form noValidate className="grid gap-4" onSubmit={submitPayment}>
          <DialogHeader>
            <DialogTitle>New payment</DialogTitle>
            <DialogDescription>
              Paid at once with the test card, as your app&apos;s server does
              without a checkout page. The card&apos;s outcome decides it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Gateway"
              fieldId={`${fieldIdPrefix}-provider`}
              value={formValues.provider}
              options={(gatewaysQuery.data ?? []).map((paymentGateway) => ({
                value: paymentGateway.key,
                label: paymentGateway.name,
              }))}
              onChange={(provider) => changeValue("provider", provider)}
            />
            <SelectField
              label="Capture"
              fieldId={`${fieldIdPrefix}-capture`}
              value={formValues.captureMethod}
              options={Object.entries(captureLabels).map(
                ([captureMethod, captureLabel]) => ({
                  value: captureMethod,
                  label: captureLabel,
                }),
              )}
              onChange={(captureMethod) =>
                changeValue(
                  "captureMethod",
                  captureMethod as PaymentCaptureMethod,
                )
              }
            />
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
            <Button type="submit" disabled={createPayment.isPending}>
              Pay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
