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
import { ActivityChart } from "@/features/overview/activity/activity-chart";
import { activitySeries } from "@/features/overview/activity/activity-series";
import { ActivityTable } from "@/features/overview/activity/activity-table";
import type { ActivityBucket } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function ActivityLegend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {activitySeries.map((series) => (
        <li key={series.countKey} className="flex items-center gap-1.5">
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
          <ActivityTable activityBuckets={activityBuckets} />
        ) : (
          <>
            <ActivityLegend />
            <ActivityChart activityBuckets={activityBuckets} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
