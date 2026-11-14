import { createFileRoute } from "@tanstack/react-router";

import { WebhookEndpointsPage } from "@/features/webhooks/endpoints/webhook-endpoints-page";

export type WebhookEndpointsSearchParams = {
  /** Opens the add sheet with this template chosen ("Use in new endpoint"). */
  template?: string;
  /** Opens this endpoint's sheet, e.g. from a simulation's Webhooks row (WH-13.3). */
  endpoint?: string;
};

function readSearchText(searchValue: unknown): string | undefined {
  return typeof searchValue === "string" ? searchValue : undefined;
}

export const Route = createFileRoute("/webhooks/endpoints")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhookEndpointsSearchParams => ({
    template: readSearchText(searchParams.template),
    endpoint: readSearchText(searchParams.endpoint),
  }),
  component: WebhookEndpointsPage,
});
