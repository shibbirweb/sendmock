import { createFileRoute } from "@tanstack/react-router";

import { OverviewStatCards } from "@/features/overview/overview-stat-cards";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Everything your apps sent to MessageHook, updated live. The full
          dashboard arrives in Phase U1.
        </p>
      </div>
      <OverviewStatCards />
    </div>
  );
}
