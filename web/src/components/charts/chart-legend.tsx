import type { ChartSeries } from "@/components/charts/chart-series";
import { cn } from "@/lib/utils";

/** A swatch and label per series, so colour is never the only cue. */
export function ChartLegend<Bucket>({
  chartSeries,
}: {
  chartSeries: ChartSeries<Bucket>[];
}) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {chartSeries.map((series) => (
        <li key={series.seriesKey} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-[2px]", series.swatchClassName)}
          />
          {series.label}
        </li>
      ))}
    </ul>
  );
}
