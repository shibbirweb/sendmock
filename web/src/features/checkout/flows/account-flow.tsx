import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { accentButtonClassName } from "@/features/checkout/flows/accent-button-classes";
import type { FlowProps } from "@/features/checkout/flows/flow-props";
import { formatMinorAmount } from "@/lib/payments/format-money";

/** The account flow: signed in as the method's test account, approve or cancel (PY-12.3). */
export function AccountFlow({
  checkoutSession,
  paymentMethod,
  checkoutActions,
}: FlowProps) {
  return (
    <section aria-label={paymentMethod.name} className="grid gap-4">
      <div className="grid gap-1 rounded-md border p-3 text-sm">
        <span className="text-muted-foreground">
          Signed in as the test account
        </span>
        <span className="font-mono">{paymentMethod.test_account}</span>
        <span className="text-muted-foreground">
          Pay with: {paymentMethod.name} balance
        </span>
      </div>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
      <Button
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
        onClick={() => {
          checkoutActions.submit({
            action: "pay",
            method_key: paymentMethod.key,
          });
        }}
      >
        Approve and pay{" "}
        {formatMinorAmount(
          checkoutSession.amount_minor,
          checkoutSession.currency,
        )}
      </Button>
      <Button
        variant="ghost"
        disabled={checkoutActions.isSubmitting}
        onClick={() => {
          checkoutActions.submit({ action: "cancel" });
        }}
      >
        Cancel and return to {checkoutSession.merchant_name}
      </Button>
    </section>
  );
}
