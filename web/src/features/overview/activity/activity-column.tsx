import { activitySeries } from "@/features/overview/activity/activity-series";
import type { ActivityBucket } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * One hour as stacked segments: emails at the baseline, a 2px surface gap
 * between segments and a 4px rounded top on the highest one.
 */
export function ActivityColumn({
  activityBucket,
  axisMaximum,
  isActive,
  onActivate,
}: {
  activityBucket: ActivityBucket;
  axisMaximum: number;
  isActive: boolean;
  onActivate: () => void;
}) {
  const visibleSegments = activitySeries.filter(
    (series) => activityBucket[series.countKey] > 0,
  );
  const columnTotal = visibleSegments.reduce(
    (totalCount, series) => totalCount + activityBucket[series.countKey],
    0,
  );

  return (
    <div
      data-testid="activity-column"
      className={cn(
        "flex h-full flex-1 items-end justify-center rounded-sm px-px",
        isActive && "bg-muted/70",
      )}
      onMouseEnter={onActivate}
    >
      {columnTotal > 0 && (
        <div
          className="flex w-full max-w-6 flex-col-reverse gap-0.5"
          style={{ height: `${(columnTotal / axisMaximum) * 100}%` }}
        >
          {visibleSegments.map((series, segmentIndex) => (
            <div
              key={series.countKey}
              className={cn(
                "min-h-px",
                series.swatchClassName,
                segmentIndex === visibleSegments.length - 1 &&
                  "rounded-t-[4px]",
              )}
              style={{
                flexGrow: activityBucket[series.countKey],
                flexBasis: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
