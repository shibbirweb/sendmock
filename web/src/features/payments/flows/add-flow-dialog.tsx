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
import { useSavePaymentFlow } from "@/lib/api/hooks/use-payment-flow-queries";
import type { PaymentFlowDefinition, PaymentFlowInput } from "@/lib/api/types";
import {
  buildDefaultStep,
  describeFlowSteps,
} from "@/lib/payments/payment-step-catalogue";
import { toDefinitionKey } from "@/lib/payments/to-definition-key";
import { validatePaymentFlow } from "@/lib/payments/validate-payment-flow";

const blankStart = "blank";

type FlowDraft = { name: string; typedKey: string | null; pickerTab: string };

function DraftField({
  label,
  value,
  hint,
  errorMessage,
  isCode = false,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  errorMessage: string | undefined;
  isCode?: boolean;
  onChange: (nextValue: string) => void;
}) {
  const fieldId = React.useId();

  return (
    <FormField
      label={label}
      fieldId={fieldId}
      hint={hint}
      errorMessage={errorMessage}
    >
      <Input
        id={fieldId}
        className={isCode ? "font-mono text-sm" : undefined}
        value={value}
        aria-invalid={errorMessage !== undefined}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
    </FormField>
  );
}

/** A new flow from a name, a picker tab and a starting point, then composed in the sheet (PY-12.6). Mount when opening. */
export function AddFlowDialog({
  paymentFlows,
  onCreated,
  onClose,
}: {
  paymentFlows: PaymentFlowDefinition[];
  onCreated: (createdFlow: PaymentFlowDefinition) => void;
  onClose: () => void;
}) {
  const startPickerId = React.useId();
  const savePaymentFlow = useSavePaymentFlow();
  const [flowDraft, setFlowDraft] = React.useState<FlowDraft>({
    name: "",
    typedKey: null,
    pickerTab: "",
  });
  const [startFlowKey, setStartFlowKey] = React.useState(blankStart);
  const [errorMessages, setErrorMessages] = React.useState<
    Partial<Record<string, string>>
  >({});
  const flowKey = flowDraft.typedKey ?? toDefinitionKey(flowDraft.name);
  const changeDraft = (changedFields: Partial<FlowDraft>) => {
    setFlowDraft((previousDraft) => ({ ...previousDraft, ...changedFields }));
  };
  const buildFlowInput = (): PaymentFlowInput => ({
    key: flowKey,
    name: flowDraft.name.trim(),
    picker_tab: flowDraft.pickerTab.trim(),
    steps: paymentFlows.find((paymentFlow) => paymentFlow.key === startFlowKey)
      ?.steps ?? [buildDefaultStep("confirm")],
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const flowInput = buildFlowInput();
            const validationErrors = validatePaymentFlow(
              flowInput,
              paymentFlows,
              true,
            );
            setErrorMessages(validationErrors);
            if (Object.keys(validationErrors).length > 0) {
              return;
            }
            savePaymentFlow.mutate(
              { flowInput, isNew: true },
              {
                onSuccess: onCreated,
                onError: (requestError) => {
                  setErrorMessages({
                    key:
                      requestError instanceof ApiError
                        ? requestError.message
                        : "Could not add the flow",
                  });
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a payment flow</DialogTitle>
            <DialogDescription>
              Name it and pick where to start; you compose its steps next.
            </DialogDescription>
          </DialogHeader>
          <DraftField
            label="Name"
            value={flowDraft.name}
            errorMessage={errorMessages.name}
            onChange={(name) => changeDraft({ name })}
          />
          <DraftField
            label="Key"
            hint="Used by the API; fixed once added."
            isCode
            value={flowKey}
            errorMessage={errorMessages.key}
            onChange={(typedKey) => changeDraft({ typedKey })}
          />
          <DraftField
            label="Picker tab"
            hint="Its methods show under this tab on checkout pages, e.g. Mobile banking."
            value={flowDraft.pickerTab}
            errorMessage={errorMessages.picker_tab}
            onChange={(pickerTab) => changeDraft({ pickerTab })}
          />
          <FormField label="Start from" fieldId={startPickerId}>
            <Select value={startFlowKey} onValueChange={setStartFlowKey}>
              <SelectTrigger id={startPickerId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={blankStart}>One confirm step</SelectItem>
                {paymentFlows.map((paymentFlow) => (
                  <SelectItem key={paymentFlow.key} value={paymentFlow.key}>
                    {paymentFlow.name} steps:{" "}
                    {describeFlowSteps(paymentFlow.steps)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={savePaymentFlow.isPending}>
              Add flow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
