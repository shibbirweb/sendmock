import { createFileRoute } from "@tanstack/react-router";

import { WebhooksOverviewPage } from "@/features/webhooks/overview/webhooks-overview-page";

export type WebhooksOverviewSearchParams = {
  /** 24 hours unless `7d`. */
  range?: "7d";
  endpoint?: string;
};

export const Route = createFileRoute("/webhooks/overview")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhooksOverviewSearchParams => ({
    range: searchParams.range === "7d" ? "7d" : undefined,
    endpoint:
      typeof searchParams.endpoint === "string"
        ? searchParams.endpoint
        : undefined,
  }),
  component: WebhooksOverviewPage,
});
