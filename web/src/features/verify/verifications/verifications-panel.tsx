import { useQueryClient } from "@tanstack/react-query";
import { SearchIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { FilterChip } from "@/components/common/filter-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentTimeMs } from "@/features/verify/verifications/use-current-time";
import { VerificationTable } from "@/features/verify/verifications/verification-table";
import {
  type VerificationStatusFilter,
  verificationStatusFilters,
} from "@/features/verify/verify-labels";
import { useVerifications } from "@/lib/api/hooks/use-verify-queries";
import { queryKeys } from "@/lib/api/query-keys";

function VerificationsEmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <ShieldCheckIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">
        {isFiltered ? "No verifications match" : "No verifications yet"}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {isFiltered
          ? "Try another status or clear the search."
          : "Start one from your app with the Twilio Verify API (POST /v2/Services/{ServiceSid}/Verifications). The code shows up here and in the SMS or Mail screen."}
      </p>
    </div>
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
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-destructive">
              Could not load verifications.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void verificationsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        )}
        {verificationsQuery.isSuccess &&
          (verifications.length === 0 ? (
            <VerificationsEmptyState
              isFiltered={statusFilter !== "all" || recipientSearch !== ""}
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
