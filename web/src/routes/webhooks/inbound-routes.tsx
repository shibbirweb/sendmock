import { createFileRoute } from "@tanstack/react-router";

import { InboundRoutesPage } from "@/features/webhooks/inbound-routes/inbound-routes-page";

export const Route = createFileRoute("/webhooks/inbound-routes")({
  component: InboundRoutesPage,
});
