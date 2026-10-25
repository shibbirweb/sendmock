import { PlusIcon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlowStepCard } from "@/features/payments/flows/flow-step-card";
import { FlowVariablesReference } from "@/features/payments/flows/flow-variables-reference";
import type { PaymentFlowForm } from "@/features/payments/flows/use-payment-flow-form";
import type { PaymentStepType } from "@/lib/api/types";
import {
  findDecidingStep,
  paymentStepCatalogue,
  paymentStepTypes,
} from "@/lib/payments/payment-step-catalogue";
import { maxFlowSteps } from "@/lib/payments/validate-payment-flow";

/** Why a step type cannot be added right now, or null when it can. */
function findAddBlocker(
  flowForm: PaymentFlowForm,
  stepType: PaymentStepType,
): string | null {
  const flowSteps = flowForm.flowInput.steps;
  if (flowSteps.some((flowStep) => flowStep.type === stepType)) {
    return "Already in the flow";
  }
  if (
    paymentStepCatalogue[stepType].is_deciding &&
    findDecidingStep(flowSteps) !== undefined
  ) {
    return "The flow already has a deciding step";
  }

  return null;
}

/**
 * The flow's steps in order, composed one change at a time: add a step from
 * the catalogue, move it, remove it, and edit its labels (PY-12.6).
 */
export function FlowStepsEditor({
  flowForm,
  previewMethodName,
}: {
  flowForm: PaymentFlowForm;
  previewMethodName: string | undefined;
}) {
  const flowSteps = flowForm.flowInput.steps;

  return (
    <section aria-label="Steps" className="grid gap-3">
      <FlowVariablesReference />
      <div className="flex items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium">Steps</h3>
          <p className="text-xs text-muted-foreground">
            The checkout page runs them in this order.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={flowSteps.length >= maxFlowSteps}
            >
              <PlusIcon />
              Add step
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {paymentStepTypes.map((stepType) => {
              const addBlocker = findAddBlocker(flowForm, stepType);

              return (
                <DropdownMenuItem
                  key={stepType}
                  disabled={addBlocker !== null}
                  className="grid gap-0.5"
                  onSelect={() => flowForm.addStep(stepType)}
                >
                  <span>{paymentStepCatalogue[stepType].name}</span>
                  <span className="text-xs text-muted-foreground">
                    {addBlocker ?? paymentStepCatalogue[stepType].description}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <FormFieldError errorMessage={flowForm.fieldErrors.steps} />
      <ol className="grid gap-3">
        {flowSteps.map((flowStep, stepIndex) => (
          <FlowStepCard
            key={flowStep.type}
            flowStep={flowStep}
            stepIndex={stepIndex}
            stepCount={flowSteps.length}
            errorMessage={flowForm.fieldErrors[`steps.${stepIndex}`]}
            previewMethodName={previewMethodName}
            onMove={(position) => flowForm.moveStep(stepIndex, position)}
            onRemove={() => flowForm.removeStep(stepIndex)}
            onRelabel={(labelChanges) =>
              flowForm.relabelStep(stepIndex, labelChanges)
            }
          />
        ))}
      </ol>
    </section>
  );
}
