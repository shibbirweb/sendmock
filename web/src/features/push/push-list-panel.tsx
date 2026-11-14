import { BellRingIcon, SearchIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FilterChip } from "@/components/common/filter-chip";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  useDeletePushNotifications,
  usePushNotifications,
} from "@/lib/api/hooks/use-push-queries";
import type {
  PushListFilters,
  PushProvider,
  PushStatus,
} from "@/lib/api/types";

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

/** Push notifications with provider and status chips, a token search and Clear all. */
export function PushListPanel() {
  const [providerFilter, setProviderFilter] = React.useState<PushProvider>();
  const [statusFilter, setStatusFilter] = React.useState<PushStatus>();
  const [tokenSearch, setTokenSearch] = React.useState("");
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const pushFilters: PushListFilters = {
    provider: providerFilter,
    status: statusFilter,
    device_token: tokenSearch.trim() || undefined,
  };
  const pushQuery = usePushNotifications(pushFilters);
  const deletePushes = useDeletePushNotifications();
  const pushNotifications = pushQuery.data?.items ?? [];
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
        <Button
          variant="outline"
          size="sm"
          disabled={pushNotifications.length === 0}
          onClick={() => {
            setIsConfirmingClear(true);
          }}
        >
          <Trash2Icon />
          Clear all
        </Button>
      </div>
      <div className="min-w-0 rounded-lg border">
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
            <PushTable pushNotifications={pushNotifications} />
          ))}
      </div>
      <ConfirmActionDialog
        isOpen={isConfirmingClear}
        title="Clear every push notification?"
        consequence="Every notification this list shows is deleted; tests waiting for one see only new ones."
        confirmLabel="Clear all"
        cancelLabel="Keep them"
        onConfirm={() => {
          deletePushes.mutate(pushFilters);
        }}
        onClose={() => {
          setIsConfirmingClear(false);
        }}
      />
    </div>
  );
}
