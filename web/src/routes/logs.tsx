import { createFileRoute } from "@tanstack/react-router";
import { ScrollTextIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

function LogsPage() {
  return (
    <PagePlaceholder
      icon={ScrollTextIcon}
      title="Logs"
      description="SMTP session transcripts and API request logs, including rejected requests."
      plannedPhase="Phase U1"
    />
  );
}
