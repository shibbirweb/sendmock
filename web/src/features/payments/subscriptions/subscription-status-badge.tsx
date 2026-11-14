import type { SubscriptionStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const statusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

const statusToneClassNames: Record<SubscriptionStatus, string> = {
  trialing: "bg-muted text-foreground",
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  canceled: "bg-destructive/10 text-destructive",
};

/** The subscription's state in words, tinted by kind; the text carries the meaning. */
export function SubscriptionStatusBadge({
  subscriptionStatus,
}: {
  subscriptionStatus: SubscriptionStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusToneClassNames[subscriptionStatus],
      )}
    >
      {statusLabels[subscriptionStatus]}
    </span>
  );
}
