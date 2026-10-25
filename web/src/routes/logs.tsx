import { createFileRoute } from "@tanstack/react-router";

import { LogsPage } from "@/features/logs/logs-page";

export type LogsSearchParams = {
  /** Open tab; SMTP when left out, HTTP when only `request` is set. */
  tab?: "smtp" | "http";
  /** ID of the SMTP session whose drawer is open. */
  session?: string;
  /** ID of an API request to open, linked from messages it created. */
  request?: string;
};

function readOptionalText(searchValue: unknown): string | undefined {
  return typeof searchValue === "string" ? searchValue : undefined;
}

export const Route = createFileRoute("/logs")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): LogsSearchParams => ({
    tab:
      searchParams.tab === "http" || searchParams.tab === "smtp"
        ? searchParams.tab
        : undefined,
    session: readOptionalText(searchParams.session),
    request: readOptionalText(searchParams.request),
  }),
  component: LogsPage,
});
