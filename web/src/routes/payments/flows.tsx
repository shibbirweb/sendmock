import { createFileRoute } from "@tanstack/react-router";

import { PaymentFlowsPage } from "@/features/payments/flows/payment-flows-page";

export const Route = createFileRoute("/payments/flows")({
  component: PaymentFlowsPage,
});
