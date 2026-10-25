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
import { buildNewMethodInput } from "@/features/payments/methods/method-labels";
import { ApiError } from "@/lib/api/api-client";
import { useSavePaymentMethod } from "@/lib/api/hooks/use-payment-method-queries";
import type {
  PaymentFlowDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";
import { describeFlowSteps } from "@/lib/payments/payment-step-catalogue";
import { toDefinitionKey } from "@/lib/payments/to-definition-key";
import { validatePaymentMethod } from "@/lib/payments/validate-payment-method";

/** A new method from a flow and a name, then edited in the sheet (PY-12.1). Mount when opening. */
export function AddMethodDialog({
  paymentMethods,
  paymentFlows,
  onCreated,
  onClose,
}: {
  paymentMethods: PaymentMethodDefinition[];
  paymentFlows: PaymentFlowDefinition[];
  onCreated: (createdMethod: PaymentMethodDefinition) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const savePaymentMethod = useSavePaymentMethod();
  const [flowKey, setFlowKey] = React.useState(
    () =>
      paymentFlows.find((paymentFlow) => paymentFlow.key === "wallet")?.key ??
      paymentFlows[0]?.key ??
      "",
  );
  const pickedFlow = paymentFlows.find(
    (paymentFlow) => paymentFlow.key === flowKey,
  );
  const [methodName, setMethodName] = React.useState("");
  const [typedKey, setTypedKey] = React.useState<string | null>(null);
  const [errorMessages, setErrorMessages] = React.useState<{
    name?: string;
    key?: string;
  }>({});
  const methodKey = typedKey ?? toDefinitionKey(methodName);

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
            if (pickedFlow === undefined) {
              return;
            }
            const methodInput = buildNewMethodInput(
              pickedFlow,
              methodName.trim(),
              methodKey,
            );
            const validationErrors = validatePaymentMethod(
              methodInput,
              paymentMethods,
              true,
              pickedFlow.steps,
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
              Pick the flow the customer goes through; you set its test values
              next. Flows are edited in Payments &gt; Flows.
            </DialogDescription>
          </DialogHeader>
          <RadioCardGroup<string>
            legend="Flow"
            className="max-h-72 overflow-y-auto sm:grid-cols-2"
            selectedValue={flowKey}
            options={paymentFlows.map((paymentFlow) => ({
              value: paymentFlow.key,
              label: paymentFlow.name,
              description: describeFlowSteps(paymentFlow.steps),
            }))}
            onSelect={setFlowKey}
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
