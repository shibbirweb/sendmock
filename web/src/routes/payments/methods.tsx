import { createFileRoute } from "@tanstack/react-router";

import { PaymentMethodsPage } from "@/features/payments/methods/payment-methods-page";

export const Route = createFileRoute("/payments/methods")({
  component: PaymentMethodsPage,
});
