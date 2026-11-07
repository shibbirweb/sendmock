import { createFileRoute } from "@tanstack/react-router";

import { PaymentSubscriptionsPage } from "@/features/payments/subscriptions/payment-subscriptions-page";

export const Route = createFileRoute("/payments/subscriptions")({
  component: PaymentSubscriptionsPage,
});
