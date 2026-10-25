import type { ActivityBucket } from "@/lib/api/types";

export type ActivitySeriesKey =
  "email_count" | "sms_count" | "http_request_count";

export type ActivitySeries = {
  countKey: ActivitySeriesKey;
  label: string;
  swatchClassName: string;
};

/** Stacked bottom to top, in the fixed categorical order of the chart tokens. */
export const activitySeries: ActivitySeries[] = [
  {
    countKey: "email_count",
    label: "Emails",
    swatchClassName: "bg-chart-1",
  },
  {
    countKey: "sms_count",
    label: "SMS",
    swatchClassName: "bg-chart-2",
  },
  {
    countKey: "http_request_count",
    label: "HTTP requests",
    swatchClassName: "bg-chart-3",
  },
];

export function sumActivityBucket(activityBucket: ActivityBucket): number {
  return activitySeries.reduce(
    (totalCount, series) => totalCount + activityBucket[series.countKey],
    0,
  );
}

/** A round axis maximum (1, 2, 5, 10, 20, 50 ...) at or above the tallest column. */
export function readAxisMaximum(activityBuckets: ActivityBucket[]): number {
  const tallestTotal = Math.max(0, ...activityBuckets.map(sumActivityBucket));
  if (tallestTotal <= 4) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(tallestTotal));
  const niceStep = [1, 2, 5, 10].find(
    (stepMultiplier) => stepMultiplier * magnitude >= tallestTotal,
  );

  return (niceStep ?? 10) * magnitude;
}

/** "14:00" for the bucket that starts at 14:00 local time. */
export function formatBucketHour(bucketStart: string): string {
  return new Date(bucketStart).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "14:00 to 15:00", for the tooltip and the table. */
export function formatBucketRange(bucketStart: string): string {
  const bucketEnd = new Date(Date.parse(bucketStart) + 60 * 60 * 1000);

  return `${formatBucketHour(bucketStart)} to ${formatBucketHour(bucketEnd.toISOString())}`;
}
