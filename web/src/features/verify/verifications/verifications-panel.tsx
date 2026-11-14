import { useQueryClient } from "@tanstack/react-query";
import { SearchIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { FilterChip } from "@/components/common/filter-chip";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useVerifications } from "@/lib/api/hooks/use-verify-queries";
import { queryKeys } from "@/lib/api/query-keys";

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
  const verificationsQuery = useVerifications({
    status: selectedStatuses?.join(","),
    to: recipientSearch.trim() || undefined,
  });
  const verifications = verificationsQuery.data?.items ?? [];
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
              isFiltered={statusFilter !== "all" || recipientSearch !== ""}
              onClearFilter={() => {
                setStatusFilter("all");
                setRecipientSearch("");
              }}
            />
          ) : (
            <VerificationTable
              verifications={verifications}
              currentTimeMs={currentTimeMs}
              onCodeExpired={refreshVerifications}
            />
          ))}
      </div>
    </div>
  );
}
