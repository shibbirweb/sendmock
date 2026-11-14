import { Link } from "@tanstack/react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FailureCodeCount } from "@/lib/api/types";

/** "500" stays as is; named failures read as words. */
function describeFailureCode(failureCode: string): string {
  const failureNames: Record<string, string> = {
    render_failed: "Render failed",
    no_response: "No response",
  };

  return failureNames[failureCode] ?? `HTTP ${failureCode}`;
}

/** The most common failures with their count and share as a bar (WH-11.1). */
export function TopFailureCodesCard({
  topFailureCodes,
  endpointId,
}: {
  topFailureCodes: FailureCodeCount[];
  endpointId: string | null;
}) {
  const failureTotal = topFailureCodes.reduce(
    (countSoFar, failureCodeCount) =>
      countSoFar + failureCodeCount.failure_count,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top failure codes</CardTitle>
        <CardDescription>What went wrong most often.</CardDescription>
      </CardHeader>
      <CardContent>
        {topFailureCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No failures in this range.
          </p>
        ) : (
          <ul aria-label="Failure codes" className="grid gap-3">
            {topFailureCodes.map((failureCodeCount) => {
              const sharePercent = Math.round(
                (failureCodeCount.failure_count / failureTotal) * 100,
              );
              return (
                <li key={failureCodeCount.failure_code} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {describeFailureCode(failureCodeCount.failure_code)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {failureCodeCount.failure_count} ({sharePercent}%)
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-r-[4px] bg-chart-2"
                      style={{ width: `${sharePercent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          to="/webhooks/deliveries"
          search={{
            status: "failed",
            ...(endpointId === null ? {} : { endpoint: endpointId }),
          }}
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Open failed deliveries
        </Link>
      </CardContent>
    </Card>
  );
}
