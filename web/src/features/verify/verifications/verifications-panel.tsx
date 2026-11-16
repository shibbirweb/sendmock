import { useQueryClient } from "@tanstack/react-query";
import { SearchIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { CheckedListToolbar } from "@/components/common/checked-list-toolbar";
import { FilterChip } from "@/components/common/filter-chip";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckedItems } from "@/hooks/use-checked-items";
import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import { ConnectHint } from "@/features/onboarding/connect-hint";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { SampleButton } from "@/features/onboarding/sample-button";
import { useCurrentTimeMs } from "@/features/verify/verifications/use-current-time";
import { VerificationTable } from "@/features/verify/verifications/verification-table";
import {
  type VerificationStatusFilter,
  verificationStatusFilters,
} from "@/features/verify/verify-labels";
import {
  useDeleteVerification,
  useDeleteVerifications,
  useVerifications,
} from "@/lib/api/hooks/use-verify-queries";
import { queryKeys } from "@/lib/api/query-keys";

const verificationNoun = { one: "verification", many: "verifications" };

function VerificationsEmptyState({
  isFiltered,
  onClearFilter,
}: {
  isFiltered: boolean;
  onClearFilter: () => void;
}) {
  if (isFiltered) {
    return (
      <NoMatchState
        message="No verifications match this status or search."
        onClearFilter={onClearFilter}
      />
    );
  }

  return (
    <NoDataState
      icon={ShieldCheckIcon}
      title="No verifications yet"
      description="Start one from your app with the Twilio Verify API. The code shows up here and in the SMS screen."
    >
      <ConnectHint connectArea="verify" />
      <SampleButton sampleKind="verification" />
    </NoDataState>
  );
}

/** Verifications table with status chips and a search on the recipient. */
export function VerificationsPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    React.useState<VerificationStatusFilter>("all");
  const [recipientSearch, setRecipientSearch] = React.useState("");
  const selectedStatuses =
    verificationStatusFilters.find(
      (filterOption) => filterOption.statusFilter === statusFilter,
    )?.statuses ?? null;
  const verificationFilters = {
    status: selectedStatuses?.join(","),
    to: recipientSearch.trim() || undefined,
  };
  const verificationsQuery = useVerifications(verificationFilters);
  const verifications = React.useMemo(
    () => verificationsQuery.data?.items ?? [],
    [verificationsQuery.data],
  );
  const projectKey = useSelectedProjectKey();
  const isFiltered = statusFilter !== "all" || recipientSearch !== "";
  const checkedVerifications = useCheckedItems(
    React.useMemo(
      () => verifications.map((verification) => verification.sid),
      [verifications],
    ),
    `${statusFilter}|${recipientSearch}|${projectKey ?? ""}`,
  );
  const deleteVerification = useDeleteVerification();
  const deleteVerifications = useDeleteVerifications();
  const hasPendingVerification = verifications.some(
    (verification) => verification.status === "pending",
  );
  const currentTimeMs = useCurrentTimeMs(hasPendingVerification);
  const refreshVerifications = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.verify.all });
  }, [queryClient]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {verificationStatusFilters.map((filterOption) => (
            <FilterChip
              key={filterOption.statusFilter}
              isActive={statusFilter === filterOption.statusFilter}
              onToggle={() => {
                setStatusFilter(filterOption.statusFilter);
              }}
            >
              {filterOption.label}
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={recipientSearch}
            onChange={(changeEvent) => {
              setRecipientSearch(changeEvent.target.value);
            }}
            placeholder="Search by number or email"
            aria-label="Search verifications"
            className="pl-8"
          />
        </div>
      </div>
      <div className="min-w-0 rounded-lg border">
        <CheckedListToolbar
          itemNoun={verificationNoun}
          checkedItems={checkedVerifications}
          loadedItemCount={verifications.length}
          totalItemCount={verificationsQuery.data?.total_count ?? 0}
          isFiltered={isFiltered}
          projectKey={projectKey}
          deleteAllKeepsNote="Verify services stay."
          onDeleteItem={(verificationSid) => {
            deleteVerification.mutate(verificationSid);
          }}
          onDeleteAll={() => {
            deleteVerifications.mutate(verificationFilters);
          }}
        />
        {verificationsQuery.isPending && (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {verificationsQuery.isError && (
          <QueryErrorState
            message="Could not load verifications."
            onRetry={() => void verificationsQuery.refetch()}
          />
        )}
        {verificationsQuery.isSuccess &&
          (verifications.length === 0 ? (
            <VerificationsEmptyState
              isFiltered={isFiltered}
              onClearFilter={() => {
                setStatusFilter("all");
                setRecipientSearch("");
              }}
            />
          ) : (
            <VerificationTable
              verifications={verifications}
              checkedVerifications={checkedVerifications}
              currentTimeMs={currentTimeMs}
              onCodeExpired={refreshVerifications}
            />
          ))}
      </div>
    </div>
  );
}
