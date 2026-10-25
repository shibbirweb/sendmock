import { useSearch } from "@tanstack/react-router";
import { ActivityIcon } from "lucide-react";
import * as React from "react";

import { LoadMoreRows } from "@/components/common/load-more-rows";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import {
  anyFilterValue,
  DeliveryFilters,
  type DeliveryFilterValues,
  noDeliveryFilters,
} from "@/features/webhooks/deliveries/delivery-filters";
import { deliveryStatusFilters } from "@/features/webhooks/deliveries/delivery-status";
import { DeliveryDrawer } from "@/features/webhooks/deliveries/detail/delivery-drawer";
import { WebhookDeliveriesTable } from "@/features/webhooks/deliveries/webhook-deliveries-table";
import { useWebhookDeliveries } from "@/lib/api/hooks/use-webhook-delivery-queries";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { AppEventType, DeliveryListFilters } from "@/lib/api/types";

function toDeliveryListFilters(
  filterValues: DeliveryFilterValues,
): DeliveryListFilters {
  const selectedStatuses = deliveryStatusFilters.find(
    (filterOption) => filterOption.statusFilter === filterValues.statusFilter,
  )?.statuses;

  return {
    status: selectedStatuses?.join(","),
    endpoint_id:
      filterValues.endpointId === anyFilterValue
        ? undefined
        : filterValues.endpointId,
    event_type:
      filterValues.eventType === anyFilterValue
        ? undefined
        : (filterValues.eventType as AppEventType),
  };
}

/** Webhook deliveries: live log, filters, paging and the detail drawer (WH-03.7). */
export function WebhookDeliveriesPage() {
  const initialSearch = useSearch({ from: "/webhooks/deliveries" });
  const [filterValues, setFilterValues] = React.useState(
    (): DeliveryFilterValues => ({
      ...noDeliveryFilters,
      statusFilter: initialSearch.status ?? noDeliveryFilters.statusFilter,
      endpointId: initialSearch.endpoint ?? noDeliveryFilters.endpointId,
    }),
  );
  const deliveriesQuery = useWebhookDeliveries(
    toDeliveryListFilters(filterValues),
  );
  const endpointsQuery = useWebhookEndpoints();
  const loadedPages = deliveriesQuery.data?.pages ?? [];
  const webhookDeliveries = loadedPages.flatMap(
    (loadedPage) => loadedPage.items,
  );
  const totalCount = loadedPages[0]?.total_count ?? 0;
  const hasFilters =
    JSON.stringify(filterValues) !== JSON.stringify(noDeliveryFilters);
  const { fetchNextPage } = deliveriesQuery;
  const loadNextPage = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Webhook deliveries</h2>
          <p className="text-sm text-muted-foreground">
            Every request SendMock sent to your endpoints, live, with replay and
            retry controls.
          </p>
        </header>
        <DeliveryFilters
          filterValues={filterValues}
          webhookEndpoints={endpointsQuery.data ?? []}
          onChange={(changedValues) => {
            setFilterValues((previousValues) => ({
              ...previousValues,
              ...changedValues,
            }));
          }}
        />
        <div className="min-w-0 rounded-lg border">
          {deliveriesQuery.isPending && <Skeleton className="m-4 h-32" />}
          {deliveriesQuery.isError && (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-destructive">
                Could not load the deliveries.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void deliveriesQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {deliveriesQuery.isSuccess &&
            webhookDeliveries.length === 0 &&
            (hasFilters ? (
              <NoMatchState
                message="No deliveries match these filters."
                onClearFilter={() => {
                  setFilterValues(noDeliveryFilters);
                }}
              />
            ) : (
              <NoDataState
                icon={ActivityIcon}
                title="No deliveries yet"
                description="Deliveries appear here when a rule sends an event to an endpoint, or when you send a test from Endpoints."
              />
            ))}
          {webhookDeliveries.length > 0 && (
            <>
              <WebhookDeliveriesTable webhookDeliveries={webhookDeliveries} />
              <LoadMoreRows
                shownCount={webhookDeliveries.length}
                totalCount={totalCount}
                hasNextPage={deliveriesQuery.hasNextPage}
                isFetchingNextPage={deliveriesQuery.isFetchingNextPage}
                onLoadMore={loadNextPage}
              />
            </>
          )}
        </div>
      </div>
      <DeliveryDrawer />
    </div>
  );
}
