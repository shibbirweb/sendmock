import type {
  ChartBucketFormat,
  ChartSeries,
} from "@/components/charts/chart-series";
import type { ActivityBucket } from "@/lib/api/types";

/** Stacked bottom to top, in the fixed categorical order of the chart tokens. */
export const activitySeries: ChartSeries<ActivityBucket>[] = [
  {
    seriesKey: "email_count",
    label: "Emails",
    swatchClassName: "bg-chart-1",
    readValue: (activityBucket) => activityBucket.email_count,
  },
  {
    seriesKey: "sms_count",
    label: "SMS",
    swatchClassName: "bg-chart-2",
    readValue: (activityBucket) => activityBucket.sms_count,
  },
  {
    seriesKey: "http_request_count",
    label: "HTTP requests",
    swatchClassName: "bg-chart-3",
    readValue: (activityBucket) => activityBucket.http_request_count,
  },
];

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

/** Hourly buckets labelled every six hours (UI-03.3). */
export const hourlyBucketFormat: ChartBucketFormat<{ bucket_start: string }> = {
  readBucketKey: (bucket) => bucket.bucket_start,
  formatTick: (bucket) => formatBucketHour(bucket.bucket_start),
  formatRange: (bucket) => formatBucketRange(bucket.bucket_start),
  tickInterval: 6,
};
