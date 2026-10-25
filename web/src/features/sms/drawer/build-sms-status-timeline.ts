import type { DisplayedSmsStatus } from "@/features/sms/sms-status-ticks";
import type { SmsMessageDetail } from "@/lib/api/types";

export type SmsStatusTimelineEntry = {
  status: DisplayedSmsStatus;
  at: string;
  errorCode: string | null;
  /** Time since the first entry, so delivery delays are easy to read. */
  elapsedMs: number;
};

/**
 * The message's status history in time order, with the first read event
 * (`sms.opened`) added as a "read" entry.
 */
export function buildSmsStatusTimeline(
  smsMessage: Pick<SmsMessageDetail, "status_history" | "opened_at">,
): SmsStatusTimelineEntry[] {
  const timelineEvents: Omit<SmsStatusTimelineEntry, "elapsedMs">[] =
    smsMessage.status_history.map((statusChange) => ({
      status: statusChange.status,
      at: statusChange.at,
      errorCode: statusChange.error_code,
    }));
  if (smsMessage.opened_at !== null) {
    timelineEvents.push({
      status: "read",
      at: smsMessage.opened_at,
      errorCode: null,
    });
  }

  const sortedEvents = timelineEvents.toSorted(
    (earlierEvent, laterEvent) =>
      Date.parse(earlierEvent.at) - Date.parse(laterEvent.at),
  );
  const firstEventMs = Date.parse(sortedEvents[0]?.at ?? "");

  return sortedEvents.map((timelineEvent) => ({
    ...timelineEvent,
    elapsedMs: Date.parse(timelineEvent.at) - firstEventMs,
  }));
}

/** "+700 ms", "+1.8 s", "+2 min"; nothing for the first entry. */
export function formatElapsedTime(elapsedMs: number): string | null {
  if (elapsedMs <= 0) {
    return null;
  }
  if (elapsedMs < 1000) {
    return `+${elapsedMs} ms`;
  }
  if (elapsedMs < 60_000) {
    return `+${Number((elapsedMs / 1000).toFixed(1))} s`;
  }

  return `+${Math.round(elapsedMs / 60_000)} min`;
}
