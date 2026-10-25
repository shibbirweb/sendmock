import { createFileRoute } from "@tanstack/react-router";

import { SmsConversation } from "@/features/sms/conversation/sms-conversation";

export const Route = createFileRoute("/sms/_conversations/$threadId")({
  component: SmsConversationRoute,
});

function SmsConversationRoute() {
  const { threadId } = Route.useParams();

  // The key resets the composer and scroll position when another thread opens.
  return <SmsConversation key={threadId} threadId={threadId} />;
}
