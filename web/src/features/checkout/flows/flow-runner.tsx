import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { accentButtonClassName } from "@/features/checkout/flows/accent-button-classes";
import { buildPayRequest } from "@/features/checkout/flows/build-pay-request";
import { checkoutStepViews } from "@/features/checkout/steps/step-registry";
import {
  emptyFlowEntries,
  type FlowEntries,
} from "@/features/checkout/steps/step-view-props";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type {
  CheckoutSession,
  PaymentFlowDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";
import {
  fillStepLabels,
  readPaymentReference,
} from "@/lib/payments/flow-label-variables";
import { paymentProviderLabels } from "@/lib/payments/payment-labels";

/**
 * Runs a method's flow on the checkout page, one step at a time and in the
 * flow's order, with each step's own labels (PY-12.6). Each step's entry is
 * checked before moving on; the last step sends everything to be paid.
 */
export function FlowRunner({
  checkoutSession,
  paymentMethod,
  paymentFlow,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  paymentMethod: PaymentMethodDefinition;
  paymentFlow: PaymentFlowDefinition;
  checkoutActions: CheckoutActions;
}) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [flowEntries, setFlowEntries] =
    React.useState<FlowEntries>(emptyFlowEntries);
  const currentStep = paymentFlow.steps[stepIndex];
  if (currentStep === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        The {paymentFlow.name} flow has no steps.
      </p>
    );
  }
  const flowStep = fillStepLabels(currentStep, {
    method: paymentMethod.name,
    amount: formatMinorAmount(
      checkoutSession.amount_minor,
      checkoutSession.currency,
    ),
    currency: checkoutSession.currency,
    merchant: checkoutSession.merchant_name,
    gateway:
      paymentProviderLabels[
        checkoutSession.provider as keyof typeof paymentProviderLabels
      ] ?? checkoutSession.provider,
    reference: readPaymentReference(checkoutSession.session_id),
    customer_email: checkoutSession.customer_email ?? "",
  });
  const stepView = checkoutStepViews[flowStep.type];
  const stepCount = paymentFlow.steps.length;
  const stepViewProps = {
    flowStep,
    checkoutSession,
    paymentMethod,
    flowEntries,
    isFirstStep: stepIndex === 0,
    onEntriesChange: (changedEntries: Partial<FlowEntries>) => {
      setFlowEntries((previousEntries) => ({
        ...previousEntries,
        ...changedEntries,
      }));
    },
  };

  return (
    <form
      noValidate
      aria-label={
        flowStep.type === "card_form"
          ? "Card details"
          : `${paymentMethod.name} payment`
      }
      className="grid gap-3"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        checkoutActions.showError(null);
        const entryError =
          stepView.findEntryError?.(paymentMethod, flowEntries) ?? null;
        if (entryError !== null) {
          checkoutActions.showError(entryError);
          return;
        }
        if (stepIndex < stepCount - 1) {
          setStepIndex(stepIndex + 1);
          return;
        }
        checkoutActions.submit(
          buildPayRequest(paymentMethod, paymentFlow, flowEntries),
        );
      }}
    >
      {stepCount > 1 && (
        <p className="text-xs text-muted-foreground">
          Step {stepIndex + 1} of {stepCount}
        </p>
      )}
      {flowStep.title !== "" && (
        <h3 className="text-sm font-semibold">{flowStep.title}</h3>
      )}
      {stepView.render(stepViewProps)}
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        type="submit"
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
      >
        {flowStep.button_label}
      </Button>
      {stepView.isCancelable === true && (
        <Button
          type="button"
          variant="ghost"
          disabled={checkoutActions.isSubmitting}
          onClick={() => {
            checkoutActions.submit({ action: "cancel" });
          }}
        >
          Cancel and return to {checkoutSession.merchant_name}
        </Button>
      )}
      {stepIndex > 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            checkoutActions.showError(null);
            setStepIndex(0);
            setFlowEntries({ ...emptyFlowEntries, number: flowEntries.number });
          }}
        >
          Start over
        </Button>
      )}
      {stepView.renderAfterAction?.(stepViewProps)}
    </form>
  );
}
