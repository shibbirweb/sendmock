import {
  buildSmsStatusTimeline,
  formatElapsedTime,
} from "@/features/sms/drawer/build-sms-status-timeline";
import {
  describeSmsErrorCode,
  smsStatusLabels,
} from "@/features/sms/sms-labels";
import type { SmsMessageDetail } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const failedStatuses = new Set(["undelivered", "failed"]);

/** Every status the message went through (SM-07.6), oldest first. */
export function SmsStatusHistory({
  smsMessage,
}: {
  smsMessage: SmsMessageDetail;
}) {
  const timelineEntries = buildSmsStatusTimeline(smsMessage);

  return (
    <ol aria-label="Status history" className="grid gap-3 border-l pl-4">
      {timelineEntries.map((timelineEntry, entryIndex) => {
        const elapsedTime = formatElapsedTime(timelineEntry.elapsedMs);

        return (
          <li
            key={`${timelineEntry.status}-${entryIndex}`}
            className="relative grid gap-0.5 text-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary",
                timelineEntry.status === "read" && "bg-read-receipt",
                failedStatuses.has(timelineEntry.status) && "bg-destructive",
              )}
            />
            <span className="flex items-baseline gap-2">
              <span className="font-medium">
                {smsStatusLabels[timelineEntry.status]}
              </span>
              {elapsedTime !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {elapsedTime}
                </span>
              )}
            </span>
            {timelineEntry.errorCode !== null && (
              <span className="text-destructive">
                {describeSmsErrorCode(timelineEntry.errorCode)}
              </span>
            )}
            <time
              dateTime={timelineEntry.at}
              className="text-xs text-muted-foreground"
            >
              {formatDateTime(timelineEntry.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
