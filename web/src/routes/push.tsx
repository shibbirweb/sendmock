import { createFileRoute } from "@tanstack/react-router";

import { PushPage } from "@/features/push/push-page";

export type PushSearchParams = {
  /** Id of the notification whose drawer is open. */
  push?: string;
};

export const Route = createFileRoute("/push")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): PushSearchParams => ({
    push: typeof searchParams.push === "string" ? searchParams.push : undefined,
  }),
  component: PushPage,
});
