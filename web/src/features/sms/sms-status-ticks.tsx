import {
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  describeSmsErrorCode,
  smsStatusLabels,
} from "@/features/sms/sms-labels";
import type { SmsMessage, SmsStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type DisplayedSmsStatus = SmsStatus | "read";

const failedStatuses: SmsStatus[] = ["undelivered", "failed"];

/** Failures win over everything; a fired `sms.opened` shows as "read". */
export function readDisplayedSmsStatus(
  smsMessage: Pick<SmsMessage, "status" | "opened_at">,
): DisplayedSmsStatus {
  if (failedStatuses.includes(smsMessage.status)) {
    return smsMessage.status;
  }

  return smsMessage.opened_at === null ? smsMessage.status : "read";
}

const statusIcons: Record<DisplayedSmsStatus, LucideIcon | null> = {
  queued: ClockIcon,
  sent: CheckIcon,
  delivered: CheckCheckIcon,
  read: CheckCheckIcon,
  undelivered: CircleAlertIcon,
  failed: CircleAlertIcon,
  received: null,
};

/**
 * Status ticks for outbound messages, with the error code in the label. Inside
 * a link (the thread list) pass `hasTooltip={false}`, so nothing interactive
 * is nested in the link.
 */
export function SmsStatusTicks({
  smsMessage,
  hasTooltip = true,
}: {
  smsMessage: Pick<SmsMessage, "status" | "opened_at" | "error_code">;
  hasTooltip?: boolean;
}) {
  const displayedStatus = readDisplayedSmsStatus(smsMessage);
  const StatusIcon = statusIcons[displayedStatus];

  if (StatusIcon === null) {
    return null;
  }

  const statusLabel = smsStatusLabels[displayedStatus];
  const statusDescription =
    smsMessage.error_code === null
      ? statusLabel
      : `${statusLabel}: ${describeSmsErrorCode(smsMessage.error_code)}`;
  const statusIcon = (
    <span
      role="img"
      tabIndex={hasTooltip ? 0 : undefined}
      aria-label={statusDescription}
      data-sms-status={displayedStatus}
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        displayedStatus === "read" && "text-read-receipt",
        failedStatuses.includes(smsMessage.status) && "text-destructive",
      )}
    >
      <StatusIcon className="size-3.5" />
    </span>
  );

  if (!hasTooltip) {
    return statusIcon;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{statusIcon}</TooltipTrigger>
      <TooltipContent>{statusDescription}</TooltipContent>
    </Tooltip>
  );
}
