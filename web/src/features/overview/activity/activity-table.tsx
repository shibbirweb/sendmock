import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activitySeries,
  formatBucketRange,
  sumActivityBucket,
} from "@/features/overview/activity/activity-series";
import type { ActivityBucket } from "@/lib/api/types";

/** The chart's numbers as a table, newest hour first (UI-03.3). */
export function ActivityTable({
  activityBuckets,
}: {
  activityBuckets: ActivityBucket[];
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border">
      <Table aria-label="Activity per hour">
        <TableHeader>
          <TableRow>
            <TableHead>Hour</TableHead>
            {activitySeries.map((series) => (
              <TableHead key={series.countKey} className="text-right">
                {series.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...activityBuckets].reverse().map((activityBucket) => (
            <TableRow key={activityBucket.bucket_start}>
              <TableCell>
                {formatBucketRange(activityBucket.bucket_start)}
              </TableCell>
              {activitySeries.map((series) => (
                <TableCell
                  key={series.countKey}
                  className="text-right tabular-nums"
                >
                  {activityBucket[series.countKey]}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">
                {sumActivityBucket(activityBucket)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
