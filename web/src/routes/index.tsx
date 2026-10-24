import { createFileRoute } from "@tanstack/react-router";
import { GaugeIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <PagePlaceholder
      icon={GaugeIcon}
      title="Overview"
      description="Counts, webhook health and recent failures at a glance."
      plannedPhase="Phase U1"
    />
  );
}
