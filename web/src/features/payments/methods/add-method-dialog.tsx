import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
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
  buildNewMethodInput,
  methodFlowLabels,
  toMethodKey,
} from "@/features/payments/methods/method-labels";
import { ApiError } from "@/lib/api/api-client";
import { useSavePaymentMethod } from "@/lib/api/hooks/use-payment-method-queries";
import type {
  PaymentMethodDefinition,
  PaymentMethodFlow,
} from "@/lib/api/types";
import { validatePaymentMethod } from "@/lib/payments/validate-payment-method";

/** A new method from a flow and a name, then edited in the sheet (PY-12.1). Mount when opening. */
export function AddMethodDialog({
  paymentMethods,
  onCreated,
  onClose,
}: {
  paymentMethods: PaymentMethodDefinition[];
  onCreated: (createdMethod: PaymentMethodDefinition) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const savePaymentMethod = useSavePaymentMethod();
  const [flow, setFlow] = React.useState<PaymentMethodFlow>("wallet");
  const [methodName, setMethodName] = React.useState("");
  const [typedKey, setTypedKey] = React.useState<string | null>(null);
  const [errorMessages, setErrorMessages] = React.useState<{
    name?: string;
    key?: string;
  }>({});
  const methodKey = typedKey ?? toMethodKey(methodName);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const methodInput = buildNewMethodInput(
              flow,
              methodName.trim(),
              methodKey,
            );
            const validationErrors = validatePaymentMethod(
              methodInput,
              paymentMethods,
              true,
            );
            setErrorMessages({
              name: validationErrors.name,
              key: validationErrors.key,
            });
            if (
              validationErrors.name !== undefined ||
              validationErrors.key !== undefined
            ) {
              return;
            }
            savePaymentMethod.mutate(
              { methodInput, isNew: true },
              {
                onSuccess: onCreated,
                onError: (requestError) => {
                  setErrorMessages({
                    key:
                      requestError instanceof ApiError
                        ? requestError.message
                        : "Could not add the method",
                  });
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a payment method</DialogTitle>
            <DialogDescription>
              Pick how the customer pays; you set its test values next.
            </DialogDescription>
          </DialogHeader>
          <RadioCardGroup<PaymentMethodFlow>
            legend="Flow"
            className="sm:grid-cols-2"
            selectedValue={flow}
            options={Object.entries(methodFlowLabels).map(
              ([flowKey, flowLabel]) => ({
                value: flowKey as PaymentMethodFlow,
                label: flowLabel.label,
                description: flowLabel.description,
              }),
            )}
            onSelect={setFlow}
          />
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            errorMessage={errorMessages.name}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              placeholder="Upay"
              value={methodName}
              aria-invalid={errorMessages.name !== undefined}
              onChange={(changeEvent) => {
                setMethodName(changeEvent.target.value);
              }}
            />
          </FormField>
          <FormField
            label="Key"
            fieldId={`${fieldIdPrefix}-key`}
            hint="Used by the API; fixed once added."
            errorMessage={errorMessages.key}
          >
            <Input
              id={`${fieldIdPrefix}-key`}
              className="font-mono text-sm"
              value={methodKey}
              aria-invalid={errorMessages.key !== undefined}
              onChange={(changeEvent) => {
                setTypedKey(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={savePaymentMethod.isPending}>
              Add method
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
