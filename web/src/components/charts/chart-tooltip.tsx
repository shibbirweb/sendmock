import {
  type ChartBucketFormat,
  type ChartSeries,
  sumBucket,
} from "@/components/charts/chart-series";
import { cn } from "@/lib/utils";

/** Every series for one bucket; values stay in text colours, swatches carry identity. */
export function ChartTooltip<Bucket>({
  bucket,
  chartSeries,
  bucketFormat,
  bucketIndex,
  bucketCount,
}: {
  bucket: Bucket;
  chartSeries: ChartSeries<Bucket>[];
  bucketFormat: ChartBucketFormat<Bucket>;
  bucketIndex: number;
  bucketCount: number;
}) {
  const centerPercent = ((bucketIndex + 0.5) / bucketCount) * 100;
  const isNearRightEdge = centerPercent > 70;

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-0 z-10 grid min-w-40 gap-1 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={
        isNearRightEdge
          ? { right: `${100 - centerPercent}%`, marginRight: "0.75rem" }
          : { left: `${centerPercent}%`, marginLeft: "0.75rem" }
      }
    >
      <span className="font-medium">{bucketFormat.formatRange(bucket)}</span>
      {[...chartSeries].reverse().map((series) => (
        <span key={series.seriesKey} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-[2px]", series.swatchClassName)}
          />
          <span className="text-muted-foreground">{series.label}</span>
          <span className="ml-auto font-medium tabular-nums">
            {series.readValue(bucket)}
          </span>
        </span>
      ))}
      <span className="flex items-center gap-2 border-t pt-1">
        <span className="text-muted-foreground">Total</span>
        <span className="ml-auto font-medium tabular-nums">
          {sumBucket(chartSeries, bucket)}
        </span>
      </span>
      {(bucketFormat.readExtraRows?.(bucket) ?? []).map((extraRow) => (
        <span key={extraRow.label} className="flex items-center gap-2">
          <span className="text-muted-foreground">{extraRow.label}</span>
          <span className="ml-auto font-medium tabular-nums">
            {extraRow.value}
          </span>
        </span>
      ))}
    </div>
  );
}
