import { usePageTitle } from "@/hooks/use-page-title";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityCard } from "@/features/overview/activity/activity-card";
import { ConnectCard } from "@/features/overview/connect-card";
import { EndpointMetricsCard } from "@/features/overview/endpoint-metrics-card";
import { LatestMessagesCard } from "@/features/overview/latest-messages-card";
import { OverviewStatTiles } from "@/features/overview/overview-stat-tiles";
import { RecentFailuresCard } from "@/features/overview/recent-failures-card";
import { useAppStats } from "@/lib/api/hooks/use-system-queries";

function OverviewLoading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/** Home dashboard, refreshed on every realtime event (UI-03). */
export function OverviewPage() {
  usePageTitle("Overview");
  const statsQuery = useAppStats();
  const appStats = statsQuery.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-7xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Everything your apps sent to SendMock, updated live.
          </p>
        </header>
        {statsQuery.isPending && <OverviewLoading />}
        {statsQuery.isError && (
          <QueryErrorState
            message="Could not load the overview. Check that SendMock is running."
            onRetry={() => void statsQuery.refetch()}
            className="items-start rounded-lg border p-6 text-left"
          />
        )}
        {appStats !== undefined && (
          <>
            <OverviewStatTiles appStats={appStats} />
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <ActivityCard activityBuckets={appStats.activity} />
              <RecentFailuresCard recentFailures={appStats.recent_failures} />
            </div>
            <EndpointMetricsCard endpointMetrics={appStats.endpoint_metrics} />
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <LatestMessagesCard />
              <ConnectCard />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
