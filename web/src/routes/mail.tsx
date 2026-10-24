import { createFileRoute } from "@tanstack/react-router";

import { MailLayout } from "@/features/mail/mail-layout";

export type MailSearchParams = {
  /** Search box text, e.g. `from:acme is:unread invoice`. */
  q?: string;
};

export const Route = createFileRoute("/mail")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): MailSearchParams => ({
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
  }),
  component: MailLayout,
});
