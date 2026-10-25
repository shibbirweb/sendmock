import type { ChartSeries } from "@/components/charts/chart-series";
import { cn } from "@/lib/utils";

/**
 * One bucket as stacked segments: the first series at the baseline, a 2px
 * surface gap between segments and a 4px rounded top on the highest one.
 */
export function StackedColumn<Bucket>({
  bucket,
  chartSeries,
  axisMaximum,
  isActive,
  columnTestId,
  onActivate,
}: {
  bucket: Bucket;
  chartSeries: ChartSeries<Bucket>[];
  axisMaximum: number;
  isActive: boolean;
  columnTestId: string;
  onActivate: () => void;
}) {
  const visibleSegments = chartSeries.filter(
    (series) => series.readValue(bucket) > 0,
  );
  const columnTotal = visibleSegments.reduce(
    (totalValue, series) => totalValue + series.readValue(bucket),
    0,
  );

  return (
    <div
      data-testid={columnTestId}
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
              key={series.seriesKey}
              className={cn(
                "min-h-px",
                series.swatchClassName,
                segmentIndex === visibleSegments.length - 1 &&
                  "rounded-t-[4px]",
              )}
              style={{ flexGrow: series.readValue(bucket), flexBasis: 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
