import { createFileRoute } from "@tanstack/react-router";

import { CheckoutPage } from "@/features/checkout/checkout-page";

export const Route = createFileRoute("/pay/$sessionId")({
  component: CheckoutRoutePage,
});

function CheckoutRoutePage() {
  const { sessionId } = Route.useParams();

  return <CheckoutPage sessionId={sessionId} />;
}
