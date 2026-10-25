import { createFileRoute } from "@tanstack/react-router";

import { VariablesPage } from "@/features/webhooks/variables/variables-page";

export type VariablesSearchParams = {
  /** Show only this endpoint's variables; "global" for global ones. */
  endpoint?: string;
};

export const Route = createFileRoute("/webhooks/variables")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): VariablesSearchParams => ({
    endpoint:
      typeof searchParams.endpoint === "string"
        ? searchParams.endpoint
        : undefined,
  }),
  component: VariablesPage,
});
