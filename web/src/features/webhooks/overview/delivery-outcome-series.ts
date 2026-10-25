import type {
  ChartBucketFormat,
  ChartSeries,
} from "@/components/charts/chart-series";
import {
  formatBucketHour,
  formatBucketRange,
} from "@/features/overview/activity/activity-series";
import { formatLatencyMs } from "@/features/overview/format-overview-values";
import type {
  DeliveryOutcomeBucket,
  WebhookMetricsRange,
} from "@/lib/api/types";

/**
 * Stacked bottom to top. The validated chart tokens (green, blue, orange)
 * rather than the status colours, which are too close to tell apart when
 * stacked; the legend names each one (WH-11.3).
 */
export const deliveryOutcomeSeries: ChartSeries<DeliveryOutcomeBucket>[] = [
  {
    seriesKey: "succeeded",
    label: "Succeeded",
    swatchClassName: "bg-chart-3",
    readValue: (outcomeBucket) => outcomeBucket.succeeded_count,
  },
  {
    seriesKey: "retrying",
    label: "Retrying",
    swatchClassName: "bg-chart-1",
    readValue: (outcomeBucket) => outcomeBucket.retrying_count,
  },
  {
    seriesKey: "failed",
    label: "Failed",
    swatchClassName: "bg-chart-2",
    readValue: (outcomeBucket) => outcomeBucket.failed_count,
  },
];

function readLatencyRows(outcomeBucket: DeliveryOutcomeBucket) {
  return [
    {
      label: "p50 latency",
      value: formatLatencyMs(outcomeBucket.p50_latency_ms),
    },
    {
      label: "p95 latency",
      value: formatLatencyMs(outcomeBucket.p95_latency_ms),
    },
  ];
}

function formatDay(bucketStart: string, dateStyle: "short" | "long"): string {
  return new Date(bucketStart).toLocaleDateString(
    undefined,
    dateStyle === "short"
      ? { weekday: "short" }
      : { weekday: "short", month: "short", day: "numeric" },
  );
}

const outcomeBucketFormats: Record<
  WebhookMetricsRange,
  ChartBucketFormat<DeliveryOutcomeBucket>
> = {
  "24h": {
    readBucketKey: (outcomeBucket) => outcomeBucket.bucket_start,
    formatTick: (outcomeBucket) => formatBucketHour(outcomeBucket.bucket_start),
    formatRange: (outcomeBucket) =>
      formatBucketRange(outcomeBucket.bucket_start),
    tickInterval: 6,
    readExtraRows: readLatencyRows,
  },
  "7d": {
    readBucketKey: (outcomeBucket) => outcomeBucket.bucket_start,
    formatTick: (outcomeBucket) =>
      formatDay(outcomeBucket.bucket_start, "short"),
    formatRange: (outcomeBucket) =>
      formatDay(outcomeBucket.bucket_start, "long"),
    tickInterval: 1,
    readExtraRows: readLatencyRows,
  },
};

export function readOutcomeBucketFormat(
  range: WebhookMetricsRange,
): ChartBucketFormat<DeliveryOutcomeBucket> {
  return outcomeBucketFormats[range];
}
