import { createFileRoute } from "@tanstack/react-router";

import { VerifyPage } from "@/features/verify/verify-page";

export type VerifySearchParams = {
  /** Open tab; Verifications when left out. */
  tab?: "services";
  /** SID of the verification whose drawer is open. */
  verification?: string;
};

export const Route = createFileRoute("/sms/verify")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): VerifySearchParams => ({
    tab: searchParams.tab === "services" ? "services" : undefined,
    verification:
      typeof searchParams.verification === "string"
        ? searchParams.verification
        : undefined,
  }),
  component: VerifyPage,
});
