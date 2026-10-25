import {
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  type LucideIcon,
  ShieldAlertIcon,
  TimerOffIcon,
} from "lucide-react";

import { verificationStatusLabels } from "@/features/verify/verify-labels";
import type { VerificationStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  VerificationStatus,
  { icon: LucideIcon; className: string }
> = {
  pending: { icon: ClockIcon, className: "border text-foreground" },
  approved: { icon: CheckCircle2Icon, className: "bg-success/10 text-success" },
  canceled: { icon: BanIcon, className: "bg-muted text-muted-foreground" },
  expired: { icon: TimerOffIcon, className: "bg-muted text-muted-foreground" },
  max_attempts_reached: {
    icon: ShieldAlertIcon,
    className: "bg-destructive/10 text-destructive",
  },
};

export function VerificationStatusBadge({
  verificationStatus,
}: {
  verificationStatus: VerificationStatus;
}) {
  const { icon: StatusIcon, className } = statusStyles[verificationStatus];

  return (
    <span
      data-verification-status={verificationStatus}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <StatusIcon className="size-3.5" aria-hidden="true" />
      {verificationStatusLabels[verificationStatus]}
    </span>
  );
}
