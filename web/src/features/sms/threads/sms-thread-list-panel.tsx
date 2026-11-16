import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { ListActionToolbar } from "@/components/common/list-action-toolbar";
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
import { useMarkThreadReadOnOpen } from "@/features/sms/threads/use-mark-thread-read-on-open";
import {
  conversationNoun,
  useSmsThreadActions,
} from "@/features/sms/threads/use-sms-thread-actions";
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

  const hasActiveFilter =
    threadFilters.searchText.trim() !== "" || threadFilters.channel !== null;
  const threadActions = useSmsThreadActions({
    visibleThreads,
    selectedThreadId,
    selectionResetKey: `${threadFilters.searchText}|${threadFilters.channel ?? ""}`,
    isFiltered: hasActiveFilter,
  });
  const { checkedThreads } = threadActions;
  useMarkThreadReadOnOpen(
    visibleThreads.find(
      (smsThread) => smsThread.thread_id === selectedThreadId,
    ),
  );

  useListKeyboardShortcuts({
    itemIds: visibleThreadIds,
    selectedItemId: selectedThreadId,
    searchInputRef,
    onOpenItemAt: openThreadAt,
    onToggleCheckedItem: checkedThreads.toggleItemChecked,
  });

  return (
    <>
      <SmsThreadFilterBar
        threadFilters={threadFilters}
        onThreadFiltersChange={setThreadFilters}
        searchInputRef={searchInputRef}
      />
      <ListActionToolbar
        itemNoun={conversationNoun}
        loadedItemCount={visibleThreads.length}
        totalItemCount={visibleThreads.length}
        checkedItemCount={checkedThreads.checkedItemCount}
        onToggleAllChecked={checkedThreads.setAllItemsChecked}
        onMarkCheckedRead={() => {
          threadActions.markCheckedThreads(true);
        }}
        onMarkCheckedUnread={() => {
          threadActions.markCheckedThreads(false);
        }}
        onDeleteChecked={threadActions.deleteCheckedThreads}
        isFiltered={hasActiveFilter}
        projectKey={threadActions.projectKey}
        onDeleteAll={threadActions.deleteAllThreads}
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
              isChecked={checkedThreads.isItemChecked(smsThread.thread_id)}
              isAnyChecked={checkedThreads.checkedItemCount > 0}
              onCheckedChange={(isChecked) => {
                checkedThreads.setItemChecked(smsThread.thread_id, isChecked);
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}
