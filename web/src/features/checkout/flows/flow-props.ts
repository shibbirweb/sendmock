import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession, PaymentMethodDefinition } from "@/lib/api/types";

/** What every flow component gets: the session, the method it runs and the page actions. */
export type FlowProps = {
  checkoutSession: CheckoutSession;
  paymentMethod: PaymentMethodDefinition;
  checkoutActions: CheckoutActions;
};
