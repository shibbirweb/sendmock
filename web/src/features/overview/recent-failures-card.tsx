import { Link } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RecentFailedDelivery } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";

function describeFailure(recentFailure: RecentFailedDelivery): string {
  if (recentFailure.status_code !== null) {
    return `HTTP ${recentFailure.status_code}`;
  }

  return recentFailure.error_message ?? "Failed";
}

/** The newest failed deliveries, each opening the delivery (UI-03.1, UI-03.2). */
export function RecentFailuresCard({
  recentFailures,
}: {
  recentFailures: RecentFailedDelivery[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent failures</CardTitle>
        <CardDescription>
          Failed or exhausted webhook deliveries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentFailures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No failed deliveries. Every webhook got through.
          </p>
        ) : (
          <ul aria-label="Recent failures" className="grid gap-1">
            {recentFailures.map((recentFailure) => (
              <li key={recentFailure.delivery_id}>
                <Link
                  to="/webhooks/deliveries"
                  search={{ delivery: recentFailure.delivery_id }}
                  className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <CircleAlertIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                  />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {recentFailure.endpoint_name}
                      </span>
                      <time
                        dateTime={recentFailure.created_at}
                        title={formatDateTime(recentFailure.created_at)}
                        className="ml-auto shrink-0 text-xs text-muted-foreground"
                      >
                        {formatRelativeTime(recentFailure.created_at)}
                      </time>
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {recentFailure.event_type}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate">
                        {describeFailure(recentFailure)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
