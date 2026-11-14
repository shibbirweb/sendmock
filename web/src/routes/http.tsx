import { createFileRoute } from "@tanstack/react-router";

import { HttpCatcherLayout } from "@/features/http/http-catcher-layout";

export type HttpCatcherSearchParams = {
  /** The selected bin; none shows every request. */
  bin?: string;
  tab?: "responses";
  request?: string;
};

export const Route = createFileRoute("/http")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): HttpCatcherSearchParams => ({
    bin: typeof searchParams.bin === "string" ? searchParams.bin : undefined,
    tab: searchParams.tab === "responses" ? "responses" : undefined,
    request:
      typeof searchParams.request === "string"
        ? searchParams.request
        : undefined,
  }),
  component: HttpCatcherLayout,
});
