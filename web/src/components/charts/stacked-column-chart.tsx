import * as React from "react";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import {
  type ChartBucketFormat,
  type ChartSeries,
  readAxisMaximum,
  sumBucket,
} from "@/components/charts/chart-series";
import { StackedColumn } from "@/components/charts/stacked-column";

function readNextBucketIndex(
  pressedKey: string,
  currentIndex: number | null,
  bucketCount: number,
): number | null {
  const lastIndex = bucketCount - 1;
  const startIndex = currentIndex ?? lastIndex;

  switch (pressedKey) {
    case "ArrowLeft":
      return Math.max(0, startIndex - (currentIndex === null ? 0 : 1));
    case "ArrowRight":
      return Math.min(lastIndex, startIndex + (currentIndex === null ? 0 : 1));
    case "Home":
      return 0;
    case "End":
      return lastIndex;
    default:
      return null;
  }
}

/**
 * Stacked columns with one y-axis. Hover or the arrow keys pick a bucket and
 * show every series for it; screen readers hear the same summary.
 */
export function StackedColumnChart<Bucket>({
  buckets,
  chartSeries,
  bucketFormat,
  plotLabel,
  columnTestId,
}: {
  buckets: Bucket[];
  chartSeries: ChartSeries<Bucket>[];
  bucketFormat: ChartBucketFormat<Bucket>;
  /** Names the plot and says how to read it with the keyboard. */
  plotLabel: string;
  columnTestId: string;
}) {
  const [activeBucketIndex, setActiveBucketIndex] = React.useState<
    number | null
  >(null);
  const axisMaximum = readAxisMaximum(
    buckets.map((bucket) => sumBucket(chartSeries, bucket)),
  );
  const activeBucket =
    activeBucketIndex === null ? undefined : buckets[activeBucketIndex];

  const describeBucket = (bucket: Bucket) => {
    const seriesValues = chartSeries
      .map((series) => `${series.readValue(bucket)} ${series.label}`)
      .join(", ");
    return `${bucketFormat.formatRange(bucket)}: ${seriesValues}, ${sumBucket(chartSeries, bucket)} in total`;
  };

  function handlePlotKeyDown(keyboardEvent: React.KeyboardEvent) {
    const nextIndex = readNextBucketIndex(
      keyboardEvent.key,
      activeBucketIndex,
      buckets.length,
    );
    if (nextIndex !== null) {
      keyboardEvent.preventDefault();
      setActiveBucketIndex(nextIndex);
    }
    if (keyboardEvent.key === "Escape") {
      setActiveBucketIndex(null);
    }
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
      <div className="flex h-48 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
        <span className="-translate-y-1/2">{axisMaximum}</span>
        <span>{axisMaximum / 2}</span>
        <span className="translate-y-1/2">0</span>
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={plotLabel}
        className="relative h-48 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={handlePlotKeyDown}
        onMouseLeave={() => setActiveBucketIndex(null)}
        onBlur={() => setActiveBucketIndex(null)}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col justify-between"
        >
          <span className="border-t border-border/60" />
          <span className="border-t border-border/60" />
          <span className="border-t border-border" />
        </div>
        <div aria-hidden="true" className="relative flex h-full items-end">
          {buckets.map((bucket, bucketIndex) => (
            <StackedColumn
              key={bucketFormat.readBucketKey(bucket)}
              bucket={bucket}
              chartSeries={chartSeries}
              axisMaximum={axisMaximum}
              isActive={bucketIndex === activeBucketIndex}
              columnTestId={columnTestId}
              onActivate={() => setActiveBucketIndex(bucketIndex)}
            />
          ))}
        </div>
        {activeBucket !== undefined && activeBucketIndex !== null && (
          <ChartTooltip
            bucket={activeBucket}
            chartSeries={chartSeries}
            bucketFormat={bucketFormat}
            bucketIndex={activeBucketIndex}
            bucketCount={buckets.length}
          />
        )}
        <span aria-live="polite" className="sr-only">
          {activeBucket === undefined ? "" : describeBucket(activeBucket)}
        </span>
      </div>
      <span />
      <div
        aria-hidden="true"
        className="flex text-[11px] text-muted-foreground"
      >
        {buckets.map((bucket, bucketIndex) => (
          <span
            key={bucketFormat.readBucketKey(bucket)}
            className="flex-1 whitespace-nowrap"
          >
            {bucketIndex % bucketFormat.tickInterval === 0
              ? bucketFormat.formatTick(bucket)
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
