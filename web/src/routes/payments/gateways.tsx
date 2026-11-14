import { createFileRoute } from "@tanstack/react-router";

import { PaymentGatewaysPage } from "@/features/payments/gateways/payment-gateways-page";

export const Route = createFileRoute("/payments/gateways")({
  component: PaymentGatewaysPage,
});
