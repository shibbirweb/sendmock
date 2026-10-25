import { GlobeIcon } from "lucide-react";

import { usePageTitle } from "@/hooks/use-page-title";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpBinHeader } from "@/features/http/bins/http-bin-header";
import { HttpBinList } from "@/features/http/bins/http-bin-list";
import { HttpCatcherEmptyState } from "@/features/http/http-catcher-empty-state";
import { CapturedRequestDetail } from "@/features/http/requests/captured-request-detail";
import { CapturedRequestList } from "@/features/http/requests/captured-request-list";
import { ResponseRulesPanel } from "@/features/http/responses/response-rules-panel";
import { useHttpCatcherSearch } from "@/features/http/use-http-catcher-search";
import { useHttpBins } from "@/lib/api/hooks/use-http-catcher-queries";
import { cn } from "@/lib/utils";

/**
 * Bins, requests and the selected request, like Mail (HC-01.6). The
 * Responses tab replaces the requests and detail with the bin's rules.
 */
export function HttpCatcherLayout() {
  usePageTitle("HTTP catcher");
  const binsQuery = useHttpBins();
  const catcherSearch = useHttpCatcherSearch();
  const httpBins = binsQuery.data ?? [];
  const selectedBin =
    httpBins.find((httpBin) => httpBin.id === catcherSearch.selectedBinId) ??
    null;
  const isShowingRules = selectedBin !== null && catcherSearch.isResponsesTab;

  if (binsQuery.isPending) {
    return <Skeleton className="m-4 h-96 flex-1" />;
  }
  if (binsQuery.isError) {
    return (
      <QueryErrorState
        message="Could not load the HTTP bins."
        onRetry={() => void binsQuery.refetch()}
        className="flex-1"
      />
    );
  }
  if (httpBins.length === 0) {
    return <HttpCatcherEmptyState icon={GlobeIcon} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section
        aria-label="Bins"
        className="hidden min-h-0 w-60 shrink-0 flex-col border-r lg:flex"
      >
        <HttpBinList
          httpBins={httpBins}
          selectedBinId={selectedBin?.id ?? null}
          onSelect={catcherSearch.selectBin}
        />
      </section>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <HttpBinHeader
          httpBins={httpBins}
          selectedBin={selectedBin}
          catcherSearch={catcherSearch}
        />
        {isShowingRules ? (
          <ResponseRulesPanel httpBin={selectedBin} />
        ) : (
          <div className="flex min-h-0 flex-1">
            <section
              aria-label="Requests"
              className={cn(
                "flex min-h-0 w-full flex-col border-r md:w-96 md:shrink-0",
                catcherSearch.selectedRequestId !== null && "hidden md:flex",
              )}
            >
              <CapturedRequestList
                selectedBin={selectedBin}
                selectedRequestId={catcherSearch.selectedRequestId}
                onSelect={catcherSearch.selectRequest}
              />
            </section>
            <section
              aria-label="Request"
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                catcherSearch.selectedRequestId === null && "hidden md:flex",
              )}
            >
              {catcherSearch.selectedRequestId === null ? (
                <p className="m-auto p-6 text-sm text-muted-foreground">
                  Pick a request to see what your app sent and what SendMock
                  answered.
                </p>
              ) : (
                <CapturedRequestDetail
                  key={catcherSearch.selectedRequestId}
                  requestId={catcherSearch.selectedRequestId}
                  httpBins={httpBins}
                  onClose={() => {
                    catcherSearch.selectRequest(null);
                  }}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
