import { createFileRoute } from "@tanstack/react-router";

import { WebhookRulesPage } from "@/features/webhooks/rules/webhook-rules-page";

export type WebhookRulesSearchParams = {
  /** Show only the rules of this endpoint. */
  endpoint?: string;
  /** Show only the rules on this event, e.g. from a simulation's webhook picker. */
  event?: string;
};

function readSearchText(searchValue: unknown): string | undefined {
  return typeof searchValue === "string" ? searchValue : undefined;
}

export const Route = createFileRoute("/webhooks/rules")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhookRulesSearchParams => ({
    endpoint: readSearchText(searchParams.endpoint),
    event: readSearchText(searchParams.event),
  }),
  component: WebhookRulesPage,
});
