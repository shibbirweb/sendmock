import { createFileRoute } from "@tanstack/react-router";
import { ScrollTextIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export type LogsSearchParams = {
  /** ID of an API request to open, linked from messages it created. */
  request?: string;
};

export const Route = createFileRoute("/logs")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): LogsSearchParams => ({
    request:
      typeof searchParams.request === "string"
        ? searchParams.request
        : undefined,
  }),
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
