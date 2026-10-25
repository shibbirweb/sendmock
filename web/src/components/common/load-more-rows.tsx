import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Footer under a paged table: loads the next page when it scrolls into view,
 * with a button as fallback, and shows how many rows are loaded.
 */
export function LoadMoreRows({
  shownCount,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  shownCount: number;
  totalCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sentinelElement = sentinelRef.current;
    const canObserve = typeof IntersectionObserver !== "undefined";
    if (
      sentinelElement === null ||
      !canObserve ||
      !hasNextPage ||
      isFetchingNextPage
    ) {
      return;
    }

    const visibilityObserver = new IntersectionObserver((observedEntries) => {
      if (
        observedEntries.some((observedEntry) => observedEntry.isIntersecting)
      ) {
        onLoadMore();
      }
    });
    visibilityObserver.observe(sentinelElement);

    return () => {
      visibilityObserver.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div
      ref={sentinelRef}
      className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground"
    >
      <span aria-live="polite">
        Showing {shownCount.toLocaleString()} of {totalCount.toLocaleString()}
      </span>
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
}
