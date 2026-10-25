import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentFlowStep } from "@/lib/api/types";
import { paymentStepCatalogue } from "@/lib/payments/payment-step-catalogue";

type StepLabelKey = "title" | "field_label" | "hint" | "button_label";

const labelFields: { labelKey: StepLabelKey; label: string }[] = [
  { labelKey: "title", label: "Title" },
  { labelKey: "field_label", label: "Field label" },
  { labelKey: "hint", label: "Hint" },
  { labelKey: "button_label", label: "Button text" },
];

/** One step of a flow: its type, position controls and its own labels (PY-12.6). */
export function FlowStepCard({
  flowStep,
  stepIndex,
  stepCount,
  errorMessage,
  onMove,
  onRemove,
  onRelabel,
}: {
  flowStep: PaymentFlowStep;
  stepIndex: number;
  stepCount: number;
  errorMessage: string | undefined;
  onMove: (position: number) => void;
  onRemove: () => void;
  onRelabel: (labelChanges: Partial<Omit<PaymentFlowStep, "type">>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const stepInfo = paymentStepCatalogue[flowStep.type];
  const stepName = `Step ${stepIndex + 1}: ${stepInfo.name}`;

  return (
    <li
      aria-label={stepName}
      className="grid gap-3 rounded-lg border p-3"
      data-testid="flow-step"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            {stepName}
            {stepInfo.is_deciding && (
              <Badge variant="secondary" className="text-[10px]">
                Decides the outcome
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {stepInfo.description}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${stepName} up`}
            disabled={stepIndex === 0}
            onClick={() => onMove(stepIndex - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${stepName} down`}
            disabled={stepIndex === stepCount - 1}
            onClick={() => onMove(stepIndex + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${stepName}`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {labelFields
          .filter(
            (labelField) =>
              labelField.labelKey !== "field_label" || stepInfo.has_field,
          )
          .map((labelField) => (
            <FormField
              key={labelField.labelKey}
              label={labelField.label}
              fieldId={`${fieldIdPrefix}-${labelField.labelKey}`}
            >
              <Input
                id={`${fieldIdPrefix}-${labelField.labelKey}`}
                className="text-sm"
                value={flowStep[labelField.labelKey]}
                onChange={(changeEvent) =>
                  onRelabel({ [labelField.labelKey]: changeEvent.target.value })
                }
              />
            </FormField>
          ))}
      </div>
      <FormFieldError errorMessage={errorMessage} />
    </li>
  );
}
