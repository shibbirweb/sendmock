import { createFileRoute } from "@tanstack/react-router";

import { NumbersPage } from "@/features/numbers/numbers-page";

export type NumbersSearchParams = {
  /** Open tab; Numbers when left out. */
  tab?: "services";
};

export const Route = createFileRoute("/numbers")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): NumbersSearchParams => ({
    tab: searchParams.tab === "services" ? "services" : undefined,
  }),
  component: NumbersPage,
});
