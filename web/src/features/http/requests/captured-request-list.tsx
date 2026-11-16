import * as React from "react";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { ListRowCheckbox } from "@/components/common/list-row-checkbox";
import { LoadMoreRows } from "@/components/common/load-more-rows";
import { Skeleton } from "@/components/ui/skeleton";
import { CapturedRequestToolbar } from "@/features/http/requests/captured-request-toolbar";
import { HttpMethodBadge } from "@/features/http/requests/http-method-badge";
import { useCapturedRequestActions } from "@/features/http/requests/use-captured-request-actions";
import { isRowCheckKey } from "@/features/shortcuts/is-row-check-key";
import { useCatchUrl } from "@/features/http/use-catch-url";
import type { CheckedItems } from "@/hooks/use-checked-items";
import { useCapturedHttpRequests } from "@/lib/api/hooks/use-http-catcher-queries";
import type { CapturedHttpRequest, HttpBin } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { readPathInBin } from "@/lib/http/match-response-rule";
import { cn } from "@/lib/utils";

function CapturedRequestRow({
  capturedRequest,
  isShowingBin,
  isSelected,
  checkedRequests,
  onSelect,
}: {
  capturedRequest: CapturedHttpRequest;
  isShowingBin: boolean;
  isSelected: boolean;
  checkedRequests: CheckedItems;
  onSelect: () => void;
}) {
  const pathInBin = readPathInBin(
    capturedRequest.path,
    capturedRequest.bin_name,
  );
  const isUnread = !capturedRequest.is_read;

  return (
    <li
      className={cn(
        "group/list-row flex items-center gap-2 border-b pl-3 hover:bg-muted/60",
        isSelected && "bg-muted",
      )}
      onKeyDown={(keyEvent) => {
        if (isRowCheckKey(keyEvent)) {
          keyEvent.preventDefault();
          checkedRequests.toggleItemChecked(capturedRequest.id);
        }
      }}
    >
      <ListRowCheckbox
        itemLabel={`${capturedRequest.method} request to ${pathInBin}`}
        isChecked={checkedRequests.isItemChecked(capturedRequest.id)}
        isAnyChecked={checkedRequests.checkedItemCount > 0}
        onCheckedChange={(isChecked) => {
          checkedRequests.setItemChecked(capturedRequest.id, isChecked);
        }}
      />
      <button
        type="button"
        aria-current={isSelected ? "true" : undefined}
        data-testid="captured-request"
        className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left text-sm focus-visible:bg-muted focus-visible:outline-none"
        onClick={onSelect}
      >
        <HttpMethodBadge method={capturedRequest.method} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span
            className={cn(
              "truncate font-mono text-xs",
              isUnread && "font-semibold",
            )}
          >
            {isUnread && <span className="sr-only">Unread: </span>}
            {isShowingBin ? `${capturedRequest.bin_name} ` : ""}
            {pathInBin}
          </span>
          <time
            dateTime={capturedRequest.created_at}
            title={formatDateTime(capturedRequest.created_at)}
            className="text-xs text-muted-foreground"
          >
            {formatRelativeTime(capturedRequest.created_at)}
          </time>
        </span>
        <HttpStatusBadge statusCode={capturedRequest.response_status} />
      </button>
    </li>
  );
}

function EmptyBinMessage({ binName }: { binName: string }) {
  const catchUrl = useCatchUrl(binName);

  return (
    <p className="p-6 text-center text-sm text-muted-foreground">
      No requests in {binName} yet. Send one to{" "}
      <code className="font-mono text-xs break-all">{catchUrl}</code>.
    </p>
  );
}

/** A bin's requests (or all), newest first, live, 50 at a time (HC-01.3, HC-01.6). */
export function CapturedRequestList({
  selectedBin,
  selectedRequestId,
  onSelect,
}: {
  selectedBin: HttpBin | null;
  selectedRequestId: string | null;
  onSelect: (requestId: string) => void;
}) {
  const requestsQuery = useCapturedHttpRequests(selectedBin?.id ?? null);
  const capturedRequests = React.useMemo(
    () =>
      requestsQuery.data?.pages.flatMap((requestPage) => requestPage.items) ??
      [],
    [requestsQuery.data],
  );
  const totalCount = requestsQuery.data?.pages[0]?.total_count ?? 0;
  const requestActions = useCapturedRequestActions({
    capturedRequests,
    selectedBin,
    selectedRequestId,
  });

  if (requestsQuery.isPending) {
    return (
      <div className="grid gap-2 p-3">
        {Array.from({ length: 6 }, (_, skeletonIndex) => (
          <Skeleton key={skeletonIndex} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (requestsQuery.isError) {
    return (
      <p className="p-6 text-sm text-destructive">Could not load requests.</p>
    );
  }
  const listToolbar = (
    <CapturedRequestToolbar
      loadedRequestCount={capturedRequests.length}
      totalRequestCount={totalCount}
      selectedBin={selectedBin}
      requestActions={requestActions}
    />
  );
  if (capturedRequests.length === 0) {
    return (
      <>
        {listToolbar}
        {selectedBin === null ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No requests caught yet.
          </p>
        ) : (
          <EmptyBinMessage binName={selectedBin.name} />
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {listToolbar}
      <ul aria-label="Captured requests">
        {capturedRequests.map((capturedRequest) => (
          <CapturedRequestRow
            key={capturedRequest.id}
            capturedRequest={capturedRequest}
            isShowingBin={selectedBin === null}
            isSelected={capturedRequest.id === selectedRequestId}
            checkedRequests={requestActions.checkedRequests}
            onSelect={() => {
              onSelect(capturedRequest.id);
            }}
          />
        ))}
      </ul>
      <LoadMoreRows
        shownCount={capturedRequests.length}
        totalCount={totalCount}
        hasNextPage={requestsQuery.hasNextPage}
        isFetchingNextPage={requestsQuery.isFetchingNextPage}
        onLoadMore={() => {
          void requestsQuery.fetchNextPage();
        }}
      />
    </div>
  );
}
