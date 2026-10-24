import { deliveryStatusLabels } from "@/features/mail/mail-labels";
import type { EmailDeliveryStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const problemStatuses: EmailDeliveryStatus[] = ["bounced", "complained"];

/** Small badge for a simulated delivery outcome; nothing when there is none. */
export function EmailOutcomeBadge({
  deliveryStatus,
}: {
  deliveryStatus: EmailDeliveryStatus | null;
}) {
  if (deliveryStatus === null) {
    return null;
  }

  const isProblem = problemStatuses.includes(deliveryStatus);

  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 text-[10px] font-medium uppercase",
        isProblem
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      {deliveryStatusLabels[deliveryStatus]}
    </span>
  );
}
