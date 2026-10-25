import { Link } from "@tanstack/react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatLatencyMs,
  formatPercent,
} from "@/features/overview/format-overview-values";
import type { EndpointMetrics } from "@/lib/api/types";

function SuccessRateMeter({
  successRate,
  endpointName,
}: {
  successRate: number | null;
  endpointName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={`${endpointName} success rate`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          successRate === null ? undefined : Math.round(successRate * 100)
        }
        aria-valuetext={formatPercent(successRate)}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(successRate ?? 0) * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums">{formatPercent(successRate)}</span>
    </div>
  );
}

function EndpointMetricsRow({
  endpointMetrics,
}: {
  endpointMetrics: EndpointMetrics;
}) {
  return (
    <TableRow>
      <TableCell className="max-w-48 truncate font-medium">
        {endpointMetrics.endpoint_name}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {endpointMetrics.delivery_count}
      </TableCell>
      <TableCell>
        <SuccessRateMeter
          successRate={endpointMetrics.success_rate}
          endpointName={endpointMetrics.endpoint_name}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatLatencyMs(endpointMetrics.p50_latency_ms)} /{" "}
        {formatLatencyMs(endpointMetrics.p95_latency_ms)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {endpointMetrics.retry_count}
      </TableCell>
      <TableCell>
        {endpointMetrics.top_failure_codes.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {endpointMetrics.top_failure_codes.map((failureCodeCount) => (
              <span
                key={failureCodeCount.failure_code}
                className="rounded border px-1 font-mono text-[11px]"
              >
                {failureCodeCount.failure_code} x
                {failureCodeCount.failure_count}
              </span>
            ))}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Health of each webhook endpoint over the last 24 hours (UI-03.4). */
export function EndpointMetricsCard({
  endpointMetrics,
}: {
  endpointMetrics: EndpointMetrics[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks by endpoint</CardTitle>
        <CardDescription>Deliveries in the last 24 hours.</CardDescription>
      </CardHeader>
      <CardContent>
        {endpointMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhook endpoints yet.{" "}
            <Link
              to="/webhooks/endpoints"
              className="underline underline-offset-4"
            >
              Add one
            </Link>{" "}
            to see its deliveries here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Deliveries</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead className="text-right">p50 / p95</TableHead>
                  <TableHead className="text-right">Retries</TableHead>
                  <TableHead>Top failures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpointMetrics.map((metrics) => (
                  <EndpointMetricsRow
                    key={metrics.endpoint_id}
                    endpointMetrics={metrics}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
