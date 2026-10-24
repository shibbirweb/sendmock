import { createFileRoute } from "@tanstack/react-router";

import { MailDetail } from "@/features/mail/detail/mail-detail";

export const Route = createFileRoute("/mail/$emailId")({
  component: MailDetailRoute,
});

function MailDetailRoute() {
  const { emailId } = Route.useParams();

  // The key resets tab and preview state when another email is opened.
  return <MailDetail key={emailId} emailId={emailId} />;
}
