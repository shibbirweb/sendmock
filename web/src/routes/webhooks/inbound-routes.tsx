import { createFileRoute } from "@tanstack/react-router";

import { InboundRoutesPage } from "@/features/webhooks/inbound-routes/inbound-routes-page";

export type InboundRoutesSearchParams = {
  /** ID of the route whose editor opens, e.g. from a composer's Delivers to. */
  route?: string;
};

export const Route = createFileRoute("/webhooks/inbound-routes")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): InboundRoutesSearchParams => ({
    route:
      typeof searchParams.route === "string" ? searchParams.route : undefined,
  }),
  component: InboundRoutesPage,
});
