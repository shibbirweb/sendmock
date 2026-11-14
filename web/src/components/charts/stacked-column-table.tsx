import {
  type ChartBucketFormat,
  type ChartSeries,
  sumBucket,
} from "@/components/charts/chart-series";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The chart's numbers as a table, newest bucket first. */
export function StackedColumnTable<Bucket>({
  buckets,
  chartSeries,
  bucketFormat,
  tableLabel,
  bucketHeading,
}: {
  buckets: Bucket[];
  chartSeries: ChartSeries<Bucket>[];
  bucketFormat: ChartBucketFormat<Bucket>;
  tableLabel: string;
  /** The first column's heading, e.g. "Hour". */
  bucketHeading: string;
}) {
  const extraHeadings =
    buckets[0] === undefined
      ? []
      : (bucketFormat.readExtraRows?.(buckets[0]) ?? []).map(
          (extraRow) => extraRow.label,
        );

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border">
      <Table aria-label={tableLabel}>
        <TableHeader>
          <TableRow>
            <TableHead>{bucketHeading}</TableHead>
            {chartSeries.map((series) => (
              <TableHead key={series.seriesKey} className="text-right">
                {series.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
            {extraHeadings.map((extraHeading) => (
              <TableHead key={extraHeading} className="text-right">
                {extraHeading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...buckets].reverse().map((bucket) => (
            <TableRow key={bucketFormat.readBucketKey(bucket)}>
              <TableCell>{bucketFormat.formatRange(bucket)}</TableCell>
              {chartSeries.map((series) => (
                <TableCell
                  key={series.seriesKey}
                  className="text-right tabular-nums"
                >
                  {series.readValue(bucket)}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">
                {sumBucket(chartSeries, bucket)}
              </TableCell>
              {(bucketFormat.readExtraRows?.(bucket) ?? []).map((extraRow) => (
                <TableCell
                  key={extraRow.label}
                  className="text-right tabular-nums"
                >
                  {extraRow.value}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
