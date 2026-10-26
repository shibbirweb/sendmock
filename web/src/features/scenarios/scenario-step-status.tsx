import type { ScenarioStepStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<ScenarioStepStatus, string> = {
  passed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
};

const statusLabels: Record<ScenarioStepStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
};

export function ScenarioStepStatusBadge({
  stepStatus,
}: {
  stepStatus: ScenarioStepStatus;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        statusStyles[stepStatus],
      )}
    >
      {statusLabels[stepStatus]}
    </span>
  );
}
