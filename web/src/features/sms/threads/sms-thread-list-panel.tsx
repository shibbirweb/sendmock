import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useListKeyboardShortcuts } from "@/features/shortcuts/use-list-keyboard-shortcuts";
import {
  filterSmsThreads,
  type SmsThreadFilters,
} from "@/features/sms/threads/filter-sms-threads";
import { SmsThreadEmptyState } from "@/features/sms/threads/sms-thread-empty-state";
import { SmsThreadFilterBar } from "@/features/sms/threads/sms-thread-filter-bar";
import { SmsThreadListItem } from "@/features/sms/threads/sms-thread-list-item";
import { useSmsThreads } from "@/lib/api/hooks/use-sms-queries";

const noThreadFilters: SmsThreadFilters = { searchText: "", channel: null };

/** Search, channel chips and the list of conversations, newest first. */
export function SmsThreadListPanel({
  selectedThreadId,
}: {
  selectedThreadId: string | undefined;
}) {
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const threadsQuery = useSmsThreads();
  const [threadFilters, setThreadFilters] = React.useState(noThreadFilters);

  const visibleThreads = React.useMemo(
    () => filterSmsThreads(threadsQuery.data ?? [], threadFilters),
    [threadsQuery.data, threadFilters],
  );
  const visibleThreadIds = React.useMemo(
    () => visibleThreads.map((smsThread) => smsThread.thread_id),
    [visibleThreads],
  );

  const openThreadAt = React.useCallback(
    (threadIndex: number) => {
      const targetThreadId = visibleThreadIds[threadIndex];
      if (targetThreadId === undefined) {
        return;
      }

      void navigate({
        to: "/sms/$threadId",
        params: { threadId: targetThreadId },
      });
    },
    [visibleThreadIds, navigate],
  );

  useListKeyboardShortcuts({
    itemIds: visibleThreadIds,
    selectedItemId: selectedThreadId,
    searchInputRef,
    onOpenItemAt: openThreadAt,
  });

  const hasActiveFilter =
    threadFilters.searchText.trim() !== "" || threadFilters.channel !== null;

  return (
    <>
      <SmsThreadFilterBar
        threadFilters={threadFilters}
        onThreadFiltersChange={setThreadFilters}
        searchInputRef={searchInputRef}
      />
      {threadsQuery.isPending ? (
        <div className="grid gap-3 p-3">
          {Array.from({ length: 6 }, (_, skeletonIndex) => (
            <Skeleton key={skeletonIndex} className="h-16 w-full" />
          ))}
        </div>
      ) : threadsQuery.isError ? (
        <QueryErrorState
          message="Could not load conversations."
          onRetry={() => void threadsQuery.refetch()}
          className="flex-1 p-6"
        />
      ) : visibleThreads.length === 0 ? (
        <SmsThreadEmptyState
          hasActiveFilter={hasActiveFilter}
          onClearFilter={() => {
            setThreadFilters(noThreadFilters);
          }}
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visibleThreads.map((smsThread) => (
            <SmsThreadListItem
              key={smsThread.thread_id}
              smsThread={smsThread}
              isSelected={smsThread.thread_id === selectedThreadId}
            />
          ))}
        </ul>
      )}
    </>
  );
}
