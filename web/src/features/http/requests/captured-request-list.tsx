import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { LoadMoreRows } from "@/components/common/load-more-rows";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpMethodBadge } from "@/features/http/requests/http-method-badge";
import { useCatchUrl } from "@/features/http/use-catch-url";
import { useCapturedHttpRequests } from "@/lib/api/hooks/use-http-catcher-queries";
import type { CapturedHttpRequest, HttpBin } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { readPathInBin } from "@/lib/http/match-response-rule";
import { cn } from "@/lib/utils";

function CapturedRequestRow({
  capturedRequest,
  isShowingBin,
  isSelected,
  onSelect,
}: {
  capturedRequest: CapturedHttpRequest;
  isShowingBin: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pathInBin = readPathInBin(
    capturedRequest.path,
    capturedRequest.bin_name,
  );

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? "true" : undefined}
        data-testid="captured-request"
        className={cn(
          "flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
          isSelected && "bg-muted",
        )}
        onClick={onSelect}
      >
        <HttpMethodBadge method={capturedRequest.method} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-mono text-xs">
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
  const capturedRequests =
    requestsQuery.data?.pages.flatMap((requestPage) => requestPage.items) ?? [];
  const totalCount = requestsQuery.data?.pages[0]?.total_count ?? 0;

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
  if (capturedRequests.length === 0) {
    return selectedBin === null ? (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No requests caught yet.
      </p>
    ) : (
      <EmptyBinMessage binName={selectedBin.name} />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ul aria-label="Captured requests">
        {capturedRequests.map((capturedRequest) => (
          <CapturedRequestRow
            key={capturedRequest.id}
            capturedRequest={capturedRequest}
            isShowingBin={selectedBin === null}
            isSelected={capturedRequest.id === selectedRequestId}
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
