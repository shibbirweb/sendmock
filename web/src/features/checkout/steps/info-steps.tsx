import { CopyButton } from "@/components/common/copy-button";
import { TestQrCode } from "@/features/checkout/steps/test-qr-code";
import { readPaymentReference } from "@/lib/payments/flow-label-variables";
import type {
  CheckoutStepView,
  StepViewProps,
} from "@/features/checkout/steps/step-view-props";

function StepHint({ hintText }: { hintText: string }) {
  return hintText === "" ? null : (
    <p className="text-sm text-muted-foreground">{hintText}</p>
  );
}

/** What the method's default outcome does in test mode, for steps that do not decide it. */
function TestOutcomeNote({ paymentMethod }: StepViewProps) {
  return (
    <p className="text-xs text-muted-foreground">
      In test mode it{" "}
      {paymentMethod.default_outcome === "decline" ? "is declined" : "succeeds"}
      .
    </p>
  );
}

/** Signed in as the method's test account, approve or cancel (PY-12.6). */
export const signedInAccountStepView: CheckoutStepView = {
  isCancelable: true,
  render: ({ flowStep, paymentMethod }) => (
    <div className="grid gap-1 rounded-md border p-3 text-sm">
      {flowStep.hint !== "" && (
        <span className="text-muted-foreground">{flowStep.hint}</span>
      )}
      <span className="font-mono">{paymentMethod.test_account}</span>
      <span className="text-muted-foreground">
        Pay with: {paymentMethod.name} balance
      </span>
    </div>
  ),
};

/** A QR code to scan in the app, then "I have paid" (PY-12.6). */
export const qrCodeStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <div className="grid justify-items-center gap-3 text-center">
      <TestQrCode
        seedText={stepViewProps.checkoutSession.session_id}
        label={`Test QR code for ${stepViewProps.paymentMethod.name}`}
      />
      <StepHint hintText={stepViewProps.flowStep.hint} />
      <TestOutcomeNote {...stepViewProps} />
    </div>
  ),
};

/** A reference to pay with elsewhere, then "I have paid" (PY-12.6). */
export const referenceCodeStepView: CheckoutStepView = {
  render: (stepViewProps) => {
    const paymentReference = readPaymentReference(
      stepViewProps.checkoutSession.session_id,
    );

    return (
      <div className="grid gap-3">
        <StepHint hintText={stepViewProps.flowStep.hint} />
        <div className="flex items-center justify-between gap-2 rounded-md border p-3">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Reference</span>
            <span
              className="font-mono text-base"
              data-testid="payment-reference"
            >
              {paymentReference}
            </span>
          </div>
          <CopyButton copyText={paymentReference} label="Copy reference" />
        </div>
        <TestOutcomeNote {...stepViewProps} />
      </div>
    );
  },
};

/** A confirm button; the method's default outcome decides (PY-12.6). */
export const confirmStepView: CheckoutStepView = {
  render: (stepViewProps) => (
    <div className="grid gap-1">
      <StepHint hintText={stepViewProps.flowStep.hint} />
      <TestOutcomeNote {...stepViewProps} />
    </div>
  ),
};
