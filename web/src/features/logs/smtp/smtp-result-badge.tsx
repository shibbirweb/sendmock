import { smtpResultLabels } from "@/features/logs/logs-labels";
import type { SmtpSessionResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const resultStyles: Record<SmtpSessionResult, string> = {
  delivered: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  aborted: "bg-muted text-muted-foreground",
};

export function SmtpResultBadge({
  sessionResult,
}: {
  sessionResult: SmtpSessionResult;
}) {
  return (
    <span
      data-smtp-result={sessionResult}
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        resultStyles[sessionResult],
      )}
    >
      {smtpResultLabels[sessionResult]}
    </span>
  );
}
