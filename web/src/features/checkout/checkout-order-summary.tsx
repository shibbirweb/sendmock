import type { CheckoutSession } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";

/** The merchant, what is being bought and the total. */
export function CheckoutOrderSummary({
  checkoutSession,
}: {
  checkoutSession: CheckoutSession;
}) {
  const money = (amountMinor: number) =>
    formatMinorAmount(amountMinor, checkoutSession.currency);

  return (
    <section aria-label="Order summary" className="grid content-start gap-4">
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">
          Pay {checkoutSession.merchant_name}
        </p>
        <p
          data-testid="checkout-total"
          className="text-3xl font-semibold tabular-nums"
        >
          {money(checkoutSession.amount_minor)}
        </p>
      </div>
      <ul className="grid gap-2 text-sm">
        {checkoutSession.line_items.map((lineItem) => (
          <li key={lineItem.name} className="flex justify-between gap-4">
            <span>
              {lineItem.name}
              {lineItem.quantity > 1 && (
                <span className="text-muted-foreground">
                  {" "}
                  x {lineItem.quantity}
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {money(lineItem.unit_amount_minor * lineItem.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {checkoutSession.customer_email !== null && (
        <p className="text-xs text-muted-foreground">
          Receipt to {checkoutSession.customer_email}
        </p>
      )}
    </section>
  );
}
