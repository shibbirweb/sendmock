import { createFileRoute } from "@tanstack/react-router";

import { WebhookRulesPage } from "@/features/webhooks/rules/webhook-rules-page";

export type WebhookRulesSearchParams = {
  /** Show only the rules of this endpoint. */
  endpoint?: string;
};

export const Route = createFileRoute("/webhooks/rules")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): WebhookRulesSearchParams => ({
    endpoint:
      typeof searchParams.endpoint === "string"
        ? searchParams.endpoint
        : undefined,
  }),
  component: WebhookRulesPage,
});
