import { checkoutFlows } from "@/features/checkout/flows/flow-registry";
import { MethodPicker } from "@/features/checkout/flows/method-picker";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession } from "@/lib/api/types";

/** One method shows its flow directly; several show the picker (PY-12.3). */
export function CheckoutMethodPanel({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  const [onlyMethod] = checkoutSession.methods;
  const isSingleMethod =
    checkoutSession.methods.length === 1 && onlyMethod !== undefined;

  return (
    <section
      aria-label="Payment"
      className="grid content-start gap-4 rounded-lg border p-5"
    >
      <h2 className="text-base font-semibold">
        {isSingleMethod
          ? onlyMethod.flow === "card"
            ? "Pay with card"
            : `Pay with ${onlyMethod.name}`
          : "Choose a payment method"}
      </h2>
      {checkoutSession.methods.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This gateway offers no enabled payment method. Enable one in Payments
          &gt; Methods.
        </p>
      )}
      {isSingleMethod &&
        checkoutFlows[onlyMethod.flow].render({
          checkoutSession,
          paymentMethod: onlyMethod,
          checkoutActions,
        })}
      {checkoutSession.methods.length > 1 && (
        <MethodPicker
          checkoutSession={checkoutSession}
          checkoutActions={checkoutActions}
        />
      )}
    </section>
  );
}
