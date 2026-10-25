import * as React from "react";

import { ChartLegend } from "@/components/charts/chart-legend";
import { StackedColumnChart } from "@/components/charts/stacked-column-chart";
import { StackedColumnTable } from "@/components/charts/stacked-column-table";
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
import {
  deliveryOutcomeSeries,
  readOutcomeBucketFormat,
} from "@/features/webhooks/overview/delivery-outcome-series";
import type {
  DeliveryOutcomeBucket,
  WebhookMetricsRange,
} from "@/lib/api/types";

/** Deliveries per hour or day by outcome, as a chart or a table (WH-11.3). */
export function DeliveriesOverTimeCard({
  outcomeBuckets,
  range,
}: {
  outcomeBuckets: DeliveryOutcomeBucket[];
  range: WebhookMetricsRange;
}) {
  const [isTableShown, setIsTableShown] = React.useState(false);
  const tableSwitchId = React.useId();
  const bucketFormat = readOutcomeBucketFormat(range);
  const bucketWord = range === "24h" ? "hour" : "day";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deliveries over time</CardTitle>
        <CardDescription>
          Succeeded, retrying and failed deliveries per {bucketWord}.
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
            buckets={outcomeBuckets}
            chartSeries={deliveryOutcomeSeries}
            bucketFormat={bucketFormat}
            tableLabel={`Deliveries per ${bucketWord}`}
            bucketHeading={range === "24h" ? "Hour" : "Day"}
          />
        ) : (
          <>
            <ChartLegend chartSeries={deliveryOutcomeSeries} />
            <StackedColumnChart
              buckets={outcomeBuckets}
              chartSeries={deliveryOutcomeSeries}
              bucketFormat={bucketFormat}
              plotLabel={`Deliveries per ${bucketWord}. Use the left and right arrow keys to read each ${bucketWord}.`}
              columnTestId="delivery-column"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
