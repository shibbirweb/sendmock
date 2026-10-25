import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ActivityIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { EndpointMetricsCard } from "@/features/overview/endpoint-metrics-card";
import { RecentFailuresCard } from "@/features/overview/recent-failures-card";
import { DeliveriesOverTimeCard } from "@/features/webhooks/overview/deliveries-over-time-card";
import { OverviewFilters } from "@/features/webhooks/overview/overview-filters";
import { TopFailureCodesCard } from "@/features/webhooks/overview/top-failure-codes-card";
import { WebhookMetricTiles } from "@/features/webhooks/overview/webhook-metric-tiles";
import { useWebhookMetrics } from "@/lib/api/hooks/use-webhook-delivery-queries";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookMetricsRange } from "@/lib/api/types";

const rangeDescriptions: Record<WebhookMetricsRange, string> = {
  "24h": "Deliveries in the last 24 hours.",
  "7d": "Deliveries in the last 7 days.",
};

/** Delivery health by range and endpoint, updated live (WH-11.1, WH-11.3). */
export function WebhooksOverviewPage() {
  const overviewSearch = useSearch({ from: "/webhooks/overview" });
  const navigate = useNavigate({ from: "/webhooks/overview" });
  const range: WebhookMetricsRange = overviewSearch.range ?? "24h";
  const endpointId = overviewSearch.endpoint ?? null;
  const metricsQuery = useWebhookMetrics({
    range,
    ...(endpointId === null ? {} : { endpoint_id: endpointId }),
  });
  const webhookEndpoints = useWebhookEndpoints().data ?? [];
  const webhookMetrics = metricsQuery.data;
  const narrowToEndpoint = (nextEndpointId: string | null) => {
    void navigate({
      search: (previousSearch) => ({
        ...previousSearch,
        endpoint: nextEndpointId ?? undefined,
      }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Webhooks overview</h2>
          <p className="text-sm text-muted-foreground">
            How your endpoints are doing: volume, success, latency and what
            fails.
          </p>
        </header>
        <OverviewFilters
          range={range}
          endpointId={endpointId}
          webhookEndpoints={webhookEndpoints}
          onRangeChange={(nextRange) => {
            void navigate({
              search: (previousSearch) => ({
                ...previousSearch,
                range: nextRange === "7d" ? "7d" : undefined,
              }),
            });
          }}
          onEndpointChange={narrowToEndpoint}
        />
        {webhookMetrics === undefined ? (
          <Skeleton className="h-96 w-full" />
        ) : webhookMetrics.delivery_count === 0 && endpointId === null ? (
          <NoDataState
            icon={ActivityIcon}
            title="No deliveries yet"
            description="Deliveries show up here once a rule fires or you send a test to an endpoint."
          >
            <Button size="sm" asChild>
              <Link to="/webhooks/endpoints">Go to endpoints</Link>
            </Button>
          </NoDataState>
        ) : (
          <>
            <WebhookMetricTiles webhookMetrics={webhookMetrics} />
            <DeliveriesOverTimeCard
              outcomeBuckets={webhookMetrics.buckets}
              range={range}
            />
            <EndpointMetricsCard
              title="By endpoint"
              description={rangeDescriptions[range]}
              endpointMetrics={webhookMetrics.endpoint_metrics}
              onSelectEndpoint={narrowToEndpoint}
            />
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <TopFailureCodesCard
                topFailureCodes={webhookMetrics.top_failure_codes}
                endpointId={endpointId}
              />
              <RecentFailuresCard
                recentFailures={webhookMetrics.recent_failures}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
