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
import { ApiError } from "@/lib/api/api-client";
import { useCreatePaymentGateway } from "@/lib/api/hooks/use-payment-gateway-queries";
import type { PaymentGatewayDefinition } from "@/lib/api/types";
import { toDefinitionKey } from "@/lib/payments/to-definition-key";
import {
  type PaymentGatewayFieldErrors,
  validateNewGateway,
} from "@/lib/payments/validate-payment-gateway";

const blankStart = "blank";

/** A new gateway from a built-in (copied, then edited) or blank (PY-12.2). Mount when opening. */
export function AddGatewayDialog({
  paymentGateways,
  onCreated,
  onClose,
}: {
  paymentGateways: PaymentGatewayDefinition[];
  onCreated: (createdGateway: PaymentGatewayDefinition) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const createGateway = useCreatePaymentGateway();
  const [gatewayName, setGatewayName] = React.useState("");
  const [typedKey, setTypedKey] = React.useState<string | null>(null);
  const [startFromKey, setStartFromKey] = React.useState(blankStart);
  const [errorMessages, setErrorMessages] =
    React.useState<PaymentGatewayFieldErrors>({});
  const gatewayKey = typedKey ?? toDefinitionKey(gatewayName);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const validationErrors = validateNewGateway(
              gatewayKey,
              gatewayName,
              paymentGateways,
            );
            setErrorMessages(validationErrors);
            if (Object.keys(validationErrors).length > 0) {
              return;
            }
            createGateway.mutate(
              {
                name: gatewayName.trim(),
                key: gatewayKey,
                start_from: startFromKey === blankStart ? null : startFromKey,
              },
              {
                onSuccess: onCreated,
                onError: (requestError) => {
                  setErrorMessages({
                    key:
                      requestError instanceof ApiError
                        ? requestError.message
                        : "Could not add the gateway",
                  });
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a payment gateway</DialogTitle>
            <DialogDescription>
              Emulate a provider SendMock does not ship; you set its checkout,
              redirect and notification next.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            errorMessage={errorMessages.name}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              placeholder="Nagad"
              value={gatewayName}
              aria-invalid={errorMessages.name !== undefined}
              onChange={(changeEvent) =>
                setGatewayName(changeEvent.target.value)
              }
            />
          </FormField>
          <FormField
            label="Key"
            fieldId={`${fieldIdPrefix}-key`}
            hint="The provider value in the API; fixed once added."
            errorMessage={errorMessages.key}
          >
            <Input
              id={`${fieldIdPrefix}-key`}
              className="font-mono text-sm"
              value={gatewayKey}
              aria-invalid={errorMessages.key !== undefined}
              onChange={(changeEvent) => setTypedKey(changeEvent.target.value)}
            />
          </FormField>
          <FormField label="Start from" fieldId={`${fieldIdPrefix}-start`}>
            <Select value={startFromKey} onValueChange={setStartFromKey}>
              <SelectTrigger id={`${fieldIdPrefix}-start`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={blankStart}>
                  Blank (Native shapes, Card)
                </SelectItem>
                {paymentGateways.map((paymentGateway) => (
                  <SelectItem
                    key={paymentGateway.key}
                    value={paymentGateway.key}
                  >
                    A copy of {paymentGateway.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGateway.isPending}>
              Add gateway
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
