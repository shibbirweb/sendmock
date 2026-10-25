import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSavePaymentFlow } from "@/lib/api/hooks/use-payment-flow-queries";
import type {
  PaymentFlowDefinition,
  PaymentFlowInput,
  PaymentFlowStep,
  PaymentStepType,
} from "@/lib/api/types";
import {
  addFlowStep,
  moveFlowStep,
  removeFlowStep,
  updateFlowStep,
} from "@/lib/payments/edit-flow-steps";
import { buildDefaultStep } from "@/lib/payments/payment-step-catalogue";
import {
  type PaymentFlowFieldErrors,
  validatePaymentFlow,
} from "@/lib/payments/validate-payment-flow";

export function toFlowInput(
  paymentFlow: PaymentFlowDefinition,
): PaymentFlowInput {
  return {
    key: paymentFlow.key,
    name: paymentFlow.name,
    picker_tab: paymentFlow.picker_tab,
    steps: paymentFlow.steps,
  };
}

/**
 * State, step-by-step editing, validation and saving for the flow sheet
 * (PY-12.6). Problems show as the flow changes, so a flow with no step or two
 * deciding steps is flagged before Save.
 */
export function usePaymentFlowForm(
  paymentFlow: PaymentFlowDefinition,
  onSaved: () => void,
) {
  const savePaymentFlow = useSavePaymentFlow();
  const [flowInput, setFlowInput] = React.useState(() =>
    toFlowInput(paymentFlow),
  );
  const [hasTriedSave, setTriedSave] = React.useState(false);
  const liveErrors = validatePaymentFlow(flowInput, [], false);
  // Step problems show at once; empty names only once Save was pressed.
  const fieldErrors: PaymentFlowFieldErrors = hasTriedSave
    ? liveErrors
    : { steps: liveErrors.steps };
  const changeSteps = (
    changeFlowSteps: (flowSteps: PaymentFlowStep[]) => PaymentFlowStep[],
  ) => {
    setFlowInput((previousInput) => ({
      ...previousInput,
      steps: changeFlowSteps(previousInput.steps),
    }));
  };

  return {
    flowInput,
    fieldErrors,
    isSaving: savePaymentFlow.isPending,
    updateInput: (changedFields: Partial<PaymentFlowInput>) => {
      setFlowInput((previousInput) => ({ ...previousInput, ...changedFields }));
    },
    addStep: (stepType: PaymentStepType) => {
      changeSteps((flowSteps) =>
        addFlowStep(flowSteps, buildDefaultStep(stepType)),
      );
    },
    moveStep: (stepIndex: number, position: number) => {
      changeSteps((flowSteps) => moveFlowStep(flowSteps, stepIndex, position));
    },
    removeStep: (stepIndex: number) => {
      changeSteps((flowSteps) => removeFlowStep(flowSteps, stepIndex));
    },
    relabelStep: (
      stepIndex: number,
      labelChanges: Partial<Omit<PaymentFlowStep, "type">>,
    ) => {
      changeSteps((flowSteps) =>
        updateFlowStep(flowSteps, stepIndex, labelChanges),
      );
    },
    save: () => {
      setTriedSave(true);
      if (Object.keys(liveErrors).length > 0) {
        return;
      }
      savePaymentFlow.mutate(
        { flowInput, isNew: false },
        {
          onSuccess: () => {
            toast(`${flowInput.name} saved`);
            onSaved();
          },
          onError: (requestError) => {
            toast.error(
              requestError instanceof ApiError
                ? requestError.message
                : "Could not save the flow",
            );
          },
        },
      );
    },
  };
}

export type PaymentFlowForm = ReturnType<typeof usePaymentFlowForm>;
