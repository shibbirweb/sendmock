import { verificationTimelineLabels } from "@/features/verify/verify-labels";
import type {
  VerificationTimelineEntry,
  VerificationTimelineKind,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const failureKinds = new Set<VerificationTimelineKind>([
  "check_failed",
  "max_attempts_reached",
]);

/** What happened to the verification, oldest first (VF-04.4). */
export function VerificationTimeline({
  timelineEntries,
}: {
  timelineEntries: VerificationTimelineEntry[];
}) {
  return (
    <ol aria-label="Verification timeline" className="grid gap-3 border-l pl-4">
      {timelineEntries.map((timelineEntry, entryIndex) => (
        <li
          key={`${timelineEntry.kind}-${entryIndex}`}
          className="relative grid gap-0.5 text-sm"
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary",
              timelineEntry.kind === "approved" && "bg-success",
              failureKinds.has(timelineEntry.kind) && "bg-destructive",
            )}
          />
          <span className="font-medium">
            {verificationTimelineLabels[timelineEntry.kind]}
          </span>
          <span className="text-muted-foreground">{timelineEntry.detail}</span>
          <time
            dateTime={timelineEntry.at}
            className="text-xs text-muted-foreground"
          >
            {formatDateTime(timelineEntry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
