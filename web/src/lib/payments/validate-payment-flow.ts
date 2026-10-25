import type { PaymentFlowDefinition, PaymentFlowInput } from "@/lib/api/types";
import {
  findUnknownVariables,
  flowLabelVariables,
} from "@/lib/payments/flow-label-variables";
import { paymentStepCatalogue } from "@/lib/payments/payment-step-catalogue";

export const maxFlowSteps = 6;

/** Errors by field: `key`, `name`, `picker_tab`, `steps`, and `steps.<index>` for one step's labels. */
export type PaymentFlowFieldErrors = Partial<Record<string, string>>;

const flowKeyPattern = /^[a-z][a-z0-9_]{1,31}$/;

function findStepsError(flowInput: PaymentFlowInput): string | undefined {
  if (flowInput.steps.length === 0) {
    return "Add at least one step";
  }
  const unknownStep = flowInput.steps.find(
    (flowStep) => !(flowStep.type in paymentStepCatalogue),
  );
  if (unknownStep !== undefined) {
    return `${String(unknownStep.type)} is not a step type SendMock knows`;
  }
  if (flowInput.steps.length > maxFlowSteps) {
    return `A flow has at most ${maxFlowSteps} steps`;
  }
  const decidingSteps = flowInput.steps.filter(
    (flowStep) => paymentStepCatalogue[flowStep.type].is_deciding,
  );
  if (decidingSteps.length > 1) {
    return "Use one deciding step at most (card form, account number or voucher code)";
  }
  const stepTypes = flowInput.steps.map((flowStep) => flowStep.type);

  return new Set(stepTypes).size === stepTypes.length
    ? undefined
    : "Each step type appears once";
}

/** Rules for a payment flow, shared by the Flows screen and the API (PY-12.6). */
export function validatePaymentFlow(
  flowInput: PaymentFlowInput,
  existingFlows: Pick<PaymentFlowDefinition, "key">[],
  isNew: boolean,
): PaymentFlowFieldErrors {
  const fieldErrors: PaymentFlowFieldErrors = {};
  if (isNew && !flowKeyPattern.test(flowInput.key)) {
    fieldErrors.key =
      "Use 2 to 32 lowercase letters, digits or _, starting with a letter";
  } else if (
    isNew &&
    existingFlows.some((existingFlow) => existingFlow.key === flowInput.key)
  ) {
    fieldErrors.key = `A flow with the key ${flowInput.key} already exists`;
  }
  if (flowInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (flowInput.picker_tab.trim() === "") {
    fieldErrors.picker_tab = "Enter the picker tab, e.g. Mobile banking";
  }
  const stepsError = findStepsError(flowInput);
  if (stepsError !== undefined) {
    fieldErrors.steps = stepsError;
  }
  flowInput.steps.forEach((flowStep, stepIndex) => {
    if (!(flowStep.type in paymentStepCatalogue)) {
      return;
    }
    const unknownVariables = [
      flowStep.title,
      flowStep.field_label,
      flowStep.hint,
      flowStep.button_label,
    ].flatMap(findUnknownVariables);
    if (unknownVariables.length > 0) {
      fieldErrors[`steps.${stepIndex}`] =
        `${[...new Set(unknownVariables)].join(", ")} is not a variable; use ${flowLabelVariables.map((flowVariable) => flowVariable.token).join(", ")}`;
    } else if (flowStep.button_label.trim() === "") {
      fieldErrors[`steps.${stepIndex}`] = "Enter the button text";
    } else if (
      paymentStepCatalogue[flowStep.type].has_field &&
      flowStep.field_label.trim() === ""
    ) {
      fieldErrors[`steps.${stepIndex}`] = "Enter the field label";
    }
  });

  return fieldErrors;
}
