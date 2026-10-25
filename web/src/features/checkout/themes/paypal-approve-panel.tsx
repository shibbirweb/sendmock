import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { accentButtonClassName } from "@/features/checkout/themes/accent-button-classes";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";

/** PayPal's approve step, signed in as the sandbox test buyer (PY-03.2). */
export function PaypalApprovePanel({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  return (
    <section aria-label="PayPal" className="grid gap-4">
      <div className="grid gap-1 rounded-md border p-3 text-sm">
        <span className="text-muted-foreground">
          Signed in as the test buyer
        </span>
        <span className="font-mono">sb-buyer@personal.example.com</span>
        <span className="text-muted-foreground">Pay with: PayPal balance</span>
      </div>
      <Button
        className={accentButtonClassName}
        disabled={checkoutActions.isSubmitting}
        onClick={() => {
          checkoutActions.submit({ action: "pay" });
        }}
      >
        Approve and pay{" "}
        {formatMinorAmount(
          checkoutSession.amount_minor,
          checkoutSession.currency,
        )}
      </Button>
      <FormFieldError
        errorMessage={checkoutActions.errorMessage ?? undefined}
      />
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
