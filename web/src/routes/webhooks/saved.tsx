import { createFileRoute } from "@tanstack/react-router";

import { SavedDeliveriesPage } from "@/features/webhooks/saved/saved-deliveries-page";

export const Route = createFileRoute("/webhooks/saved")({
  component: SavedDeliveriesPage,
});
