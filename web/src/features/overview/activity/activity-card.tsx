import * as React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChartLegend } from "@/components/charts/chart-legend";
import { StackedColumnChart } from "@/components/charts/stacked-column-chart";
import { StackedColumnTable } from "@/components/charts/stacked-column-table";
import {
  activitySeries,
  hourlyBucketFormat,
} from "@/features/overview/activity/activity-series";
import type { ActivityBucket } from "@/lib/api/types";

/** Activity over the last 24 hours, as a chart or as a table (UI-03.3). */
export function ActivityCard({
  activityBuckets,
}: {
  activityBuckets: ActivityBucket[];
}) {
  const [isTableShown, setIsTableShown] = React.useState(false);
  const tableSwitchId = React.useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity, last 24 hours</CardTitle>
        <CardDescription>
          Emails, SMS and HTTP requests per hour.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Switch
            id={tableSwitchId}
            checked={isTableShown}
            onCheckedChange={setIsTableShown}
          />
          <Label htmlFor={tableSwitchId} className="text-xs font-normal">
            Show as table
          </Label>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isTableShown ? (
          <StackedColumnTable
            buckets={activityBuckets}
            chartSeries={activitySeries}
            bucketFormat={hourlyBucketFormat}
            tableLabel="Activity per hour"
            bucketHeading="Hour"
          />
        ) : (
          <>
            <ChartLegend chartSeries={activitySeries} />
            <StackedColumnChart
              buckets={activityBuckets}
              chartSeries={activitySeries}
              bucketFormat={hourlyBucketFormat}
              plotLabel="Activity per hour for the last 24 hours. Use the left and right arrow keys to read each hour."
              columnTestId="activity-column"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
