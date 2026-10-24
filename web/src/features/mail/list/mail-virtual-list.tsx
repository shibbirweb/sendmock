import { useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { MailListItem } from "@/features/mail/list/mail-list-item";
import { useMailListKeyboard } from "@/features/mail/list/use-mail-list-keyboard";
import type { EmailSummary } from "@/lib/api/types";

/** Every row has the same height, so the virtualizer never has to measure. */
const mailRowHeightPx = 84;
/** Start loading the next page this many rows before the end. */
const loadMoreThresholdRows = 10;

type MailVirtualListProps = {
  emails: EmailSummary[];
  selectedEmailId: string | undefined;
  checkedEmailIds: Set<string>;
  onCheckedChange: (emailId: string, isChecked: boolean) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadNextPage: () => void;
  onDeleteEmail: (emailId: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
};

/**
 * Virtual rows: only the visible rows (plus a small overscan) are in the DOM,
 * so 5,000 emails scroll as smoothly as 20 (UI-06.2).
 */
export function MailVirtualList({
  emails,
  selectedEmailId,
  checkedEmailIds,
  onCheckedChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadNextPage,
  onDeleteEmail,
  searchInputRef,
}: MailVirtualListProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const rowCount = emails.length + (hasNextPage ? 1 : 0);

  // TanStack Virtual manages its own re-renders, so React Compiler skipping
  // this component is expected (react-hooks/incompatible-library).
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => mailRowHeightPx,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVisibleIndex = virtualRows.at(-1)?.index ?? 0;

  React.useEffect(() => {
    const isNearEnd = lastVisibleIndex >= emails.length - loadMoreThresholdRows;
    if (hasNextPage && !isFetchingNextPage && isNearEnd) {
      onLoadNextPage();
    }
  }, [
    lastVisibleIndex,
    emails.length,
    hasNextPage,
    isFetchingNextPage,
    onLoadNextPage,
  ]);

  const scrollToEmailIndex = React.useCallback(
    (emailIndex: number) => {
      rowVirtualizer.scrollToIndex(emailIndex, { align: "auto" });
    },
    [rowVirtualizer],
  );

  useMailListKeyboard({
    emails,
    selectedEmailId,
    searchInputRef,
    scrollToEmailIndex,
    onDeleteEmail,
  });

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
    >
      <ul
        className="relative w-full"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {virtualRows.map((virtualRow) => {
          const email = emails[virtualRow.index];

          return (
            <li
              key={email?.id ?? "loading-more"}
              className="absolute top-0 left-0 w-full"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {email === undefined ? (
                <div className="grid h-full gap-2 border-b px-3 py-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <MailListItem
                  email={email}
                  isSelected={email.id === selectedEmailId}
                  isChecked={checkedEmailIds.has(email.id)}
                  onCheckedChange={(isChecked) => {
                    onCheckedChange(email.id, isChecked);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
