import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <PagePlaceholder
      icon={SettingsIcon}
      title="Settings"
      description="Retention, simulation profiles, seed file, connection snippets and more."
      plannedPhase="Phase U1"
    />
  );
}
