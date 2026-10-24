import { createFileRoute } from "@tanstack/react-router";
import { BookmarkIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/webhooks/saved")({
  component: SavedDeliveriesPage,
});

function SavedDeliveriesPage() {
  return (
    <PagePlaceholder
      icon={BookmarkIcon}
      title="Saved deliveries"
      description="Named deliveries you can resend or turn into templates."
      plannedPhase="Phase U2"
    />
  );
}
