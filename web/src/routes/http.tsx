import { createFileRoute } from "@tanstack/react-router";
import { GlobeIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/http")({
  component: HttpCatcherPage,
});

function HttpCatcherPage() {
  return (
    <PagePlaceholder
      icon={GlobeIcon}
      title="HTTP catcher"
      description="Requests your app sends to Slack, Discord, push services and other APIs, with mock responses."
      plannedPhase="Phase U2"
    />
  );
}
