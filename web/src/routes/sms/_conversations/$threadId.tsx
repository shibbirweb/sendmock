import { createFileRoute } from "@tanstack/react-router";

import { SmsConversation } from "@/features/sms/conversation/sms-conversation";

export type SmsConversationSearchParams = {
  /** ID of the message whose details drawer is open. */
  message?: string;
};

export const Route = createFileRoute("/sms/_conversations/$threadId")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): SmsConversationSearchParams => ({
    message:
      typeof searchParams.message === "string"
        ? searchParams.message
        : undefined,
  }),
  component: SmsConversationRoute,
});

function SmsConversationRoute() {
  const { threadId } = Route.useParams();

  // The key resets the composer and scroll position when another thread opens.
  return <SmsConversation key={threadId} threadId={threadId} />;
}
