import { createFileRoute } from "@tanstack/react-router";

import { EmailTemplatesPage } from "@/features/mail-templates/email-templates-page";

/** Outside the Mail layout (`mail_`), so the inbox list does not wrap it. */
export const Route = createFileRoute("/mail_/templates")({
  component: EmailTemplatesPage,
});
