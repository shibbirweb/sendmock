import { createFileRoute } from "@tanstack/react-router";
import { PhoneIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/numbers")({
  component: NumbersPage,
});

function NumbersPage() {
  return (
    <PagePlaceholder
      icon={PhoneIcon}
      title="Numbers"
      description="Virtual phone numbers and Messaging Services with inbound webhook settings."
      plannedPhase="Phase U1"
    />
  );
}
