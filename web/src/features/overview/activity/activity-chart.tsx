import * as React from "react";

import { ActivityColumn } from "@/features/overview/activity/activity-column";
import {
  activitySeries,
  formatBucketHour,
  formatBucketRange,
  readAxisMaximum,
  sumActivityBucket,
} from "@/features/overview/activity/activity-series";
import { ActivityTooltip } from "@/features/overview/activity/activity-tooltip";
import type { ActivityBucket } from "@/lib/api/types";

const hourLabelInterval = 6;

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

function describeBucket(activityBucket: ActivityBucket): string {
  const seriesCounts = activitySeries
    .map((series) => `${activityBucket[series.countKey]} ${series.label}`)
    .join(", ");

  return `${formatBucketRange(activityBucket.bucket_start)}: ${seriesCounts}, ${sumActivityBucket(activityBucket)} in total`;
}

/**
 * Stacked columns per hour. Hover or arrow keys pick an hour and show every
 * series for it (UI-03.3).
 */
export function ActivityChart({
  activityBuckets,
}: {
  activityBuckets: ActivityBucket[];
}) {
  const [activeBucketIndex, setActiveBucketIndex] = React.useState<
    number | null
  >(null);
  const axisMaximum = readAxisMaximum(activityBuckets);
  const activeBucket =
    activeBucketIndex === null ? undefined : activityBuckets[activeBucketIndex];

  function handlePlotKeyDown(keyboardEvent: React.KeyboardEvent) {
    const nextIndex = readNextBucketIndex(
      keyboardEvent.key,
      activeBucketIndex,
      activityBuckets.length,
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
        aria-label="Activity per hour for the last 24 hours. Use the left and right arrow keys to read each hour."
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
          {activityBuckets.map((activityBucket, bucketIndex) => (
            <ActivityColumn
              key={activityBucket.bucket_start}
              activityBucket={activityBucket}
              axisMaximum={axisMaximum}
              isActive={bucketIndex === activeBucketIndex}
              onActivate={() => setActiveBucketIndex(bucketIndex)}
            />
          ))}
        </div>
        {activeBucket !== undefined && activeBucketIndex !== null && (
          <ActivityTooltip
            activityBucket={activeBucket}
            bucketIndex={activeBucketIndex}
            bucketCount={activityBuckets.length}
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
        {activityBuckets.map((activityBucket, bucketIndex) => (
          <span
            key={activityBucket.bucket_start}
            className="flex-1 whitespace-nowrap"
          >
            {bucketIndex % hourLabelInterval === 0
              ? formatBucketHour(activityBucket.bucket_start)
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
