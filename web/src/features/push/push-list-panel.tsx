import { BellRingIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { FilterChip } from "@/components/common/filter-chip";
import { ListActionToolbar } from "@/components/common/list-action-toolbar";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckedItems } from "@/hooks/use-checked-items";
import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import { ConnectHint } from "@/features/onboarding/connect-hint";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import {
  pushProviderLabels,
  pushProviders,
  pushStatuses,
  pushStatusLabels,
} from "@/features/push/push-labels";
import { PushTable } from "@/features/push/push-table";
import {
  useDeletePushNotification,
  useDeletePushNotifications,
  usePushNotifications,
  useUpdatePushNotification,
} from "@/lib/api/hooks/use-push-queries";
import type {
  PushListFilters,
  PushProvider,
  PushStatus,
} from "@/lib/api/types";

const pushNoun = { one: "push notification", many: "push notifications" };

function PushEmptyState({
  isFiltered,
  onClearFilter,
}: {
  isFiltered: boolean;
  onClearFilter: () => void;
}) {
  if (isFiltered) {
    return (
      <NoMatchState
        message="No notifications match this provider, status or token."
        onClearFilter={onClearFilter}
      />
    );
  }

  return (
    <NoDataState
      icon={BellRingIcon}
      title="No push notifications yet"
      description="Point your app's FCM, Expo or OneSignal SDK at SendMock and send one. It shows up here as the phone would show it."
    >
      <ConnectHint connectArea="push" />
    </NoDataState>
  );
}

/** Push notifications with provider and status chips, a token search and the list toolbar. */
export function PushListPanel() {
  const [providerFilter, setProviderFilter] = React.useState<PushProvider>();
  const [statusFilter, setStatusFilter] = React.useState<PushStatus>();
  const [tokenSearch, setTokenSearch] = React.useState("");
  const pushFilters: PushListFilters = {
    provider: providerFilter,
    status: statusFilter,
    device_token: tokenSearch.trim() || undefined,
  };
  const pushQuery = usePushNotifications(pushFilters);
  const deletePushes = useDeletePushNotifications();
  const deletePush = useDeletePushNotification();
  const updatePush = useUpdatePushNotification();
  const projectKey = useSelectedProjectKey();
  const pushNotifications = React.useMemo(
    () => pushQuery.data?.items ?? [],
    [pushQuery.data],
  );
  const checkedPushes = useCheckedItems(
    React.useMemo(
      () => pushNotifications.map((pushNotification) => pushNotification.id),
      [pushNotifications],
    ),
    `${providerFilter ?? ""}|${statusFilter ?? ""}|${tokenSearch}|${projectKey ?? ""}`,
  );
  const isFiltered =
    providerFilter !== undefined ||
    statusFilter !== undefined ||
    tokenSearch !== "";
  const clearFilters = () => {
    setProviderFilter(undefined);
    setStatusFilter(undefined);
    setTokenSearch("");
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            isActive={providerFilter === undefined}
            onToggle={() => {
              setProviderFilter(undefined);
            }}
          >
            All
          </FilterChip>
          {pushProviders.map((pushProvider) => (
            <FilterChip
              key={pushProvider}
              isActive={providerFilter === pushProvider}
              onToggle={() => {
                setProviderFilter(pushProvider);
              }}
            >
              {pushProviderLabels[pushProvider]}
            </FilterChip>
          ))}
          {pushStatuses.map((pushStatus) => (
            <FilterChip
              key={pushStatus}
              isActive={statusFilter === pushStatus}
              onToggle={() => {
                setStatusFilter(
                  statusFilter === pushStatus ? undefined : pushStatus,
                );
              }}
            >
              {pushStatusLabels[pushStatus]}
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={tokenSearch}
            onChange={(changeEvent) => {
              setTokenSearch(changeEvent.target.value);
            }}
            placeholder="Device token"
            aria-label="Filter by device token"
            className="pl-8"
          />
        </div>
      </div>
      <div className="min-w-0 rounded-lg border">
        <ListActionToolbar
          itemNoun={pushNoun}
          loadedItemCount={pushNotifications.length}
          totalItemCount={pushQuery.data?.total_count ?? 0}
          checkedItemCount={checkedPushes.checkedItemCount}
          onToggleAllChecked={checkedPushes.setAllItemsChecked}
          onMarkCheckedRead={() => {
            checkedPushes.runForCheckedItems((pushId) => {
              updatePush.mutate({ pushId, isRead: true });
            });
          }}
          onMarkCheckedUnread={() => {
            checkedPushes.runForCheckedItems((pushId) => {
              updatePush.mutate({ pushId, isRead: false });
            });
          }}
          onDeleteChecked={() => {
            checkedPushes.runForCheckedItems((pushId) => {
              deletePush.mutate(pushId);
            });
          }}
          isFiltered={isFiltered}
          projectKey={projectKey}
          onDeleteAll={() => {
            deletePushes.mutate(pushFilters);
          }}
        />
        {pushQuery.isPending && (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {pushQuery.isError && (
          <QueryErrorState
            message="Could not load push notifications."
            onRetry={() => void pushQuery.refetch()}
          />
        )}
        {pushQuery.isSuccess &&
          (pushNotifications.length === 0 ? (
            <PushEmptyState
              isFiltered={isFiltered}
              onClearFilter={clearFilters}
            />
          ) : (
            <PushTable
              pushNotifications={pushNotifications}
              checkedPushes={checkedPushes}
            />
          ))}
      </div>
    </div>
  );
}
