import { createFileRoute } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/mail")({
  component: MailPage,
});

function MailPage() {
  return (
    <PagePlaceholder
      icon={MailIcon}
      title="Mail"
      description="Every email your app sends over SMTP or provider HTTP APIs, with HTML preview, source, checks and timeline."
      plannedPhase="Phase U1"
    />
  );
}
