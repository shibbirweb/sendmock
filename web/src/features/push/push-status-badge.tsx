import { CheckCircle2Icon, XCircleIcon } from "lucide-react";

import { pushStatusLabels } from "@/features/push/push-labels";
import type { PushStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function PushStatusBadge({ pushStatus }: { pushStatus: PushStatus }) {
  const StatusIcon = pushStatus === "sent" ? CheckCircle2Icon : XCircleIcon;

  return (
    <span
      data-push-status={pushStatus}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        pushStatus === "sent"
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <StatusIcon className="size-3.5" aria-hidden="true" />
      {pushStatusLabels[pushStatus]}
    </span>
  );
}
