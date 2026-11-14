import type { SubscriptionInterval } from "@/lib/api/types";

/** Moves whole months on, ending on the month's last day when it is shorter (31 Jan to 28 Feb). */
function addMonths(startTime: Date, monthCount: number): Date {
  const nextTime = new Date(startTime);
  nextTime.setUTCDate(1);
  nextTime.setUTCMonth(nextTime.getUTCMonth() + monthCount);
  const lastDay = new Date(
    Date.UTC(nextTime.getUTCFullYear(), nextTime.getUTCMonth() + 1, 0),
  ).getUTCDate();
  nextTime.setUTCDate(Math.min(startTime.getUTCDate(), lastDay));

  return nextTime;
}

/** The timestamp one interval later. */
export function addInterval(
  timestampText: string,
  interval: SubscriptionInterval,
): string {
  const startTime = new Date(timestampText);
  if (interval === "day" || interval === "week") {
    const nextTime = new Date(startTime);
    nextTime.setUTCDate(nextTime.getUTCDate() + (interval === "day" ? 1 : 7));
    return nextTime.toISOString();
  }

  return addMonths(startTime, interval === "month" ? 1 : 12).toISOString();
}

export function addDays(timestampText: string, dayCount: number): string {
  const nextTime = new Date(timestampText);
  nextTime.setUTCDate(nextTime.getUTCDate() + dayCount);

  return nextTime.toISOString();
}
