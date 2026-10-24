import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/sms/verify")({
  component: VerifyPage,
});

function VerifyPage() {
  return (
    <PagePlaceholder
      icon={ShieldCheckIcon}
      title="Verify"
      description="Twilio Verify verifications with codes, attempts and force-state controls."
      plannedPhase="Phase U1"
    />
  );
}
