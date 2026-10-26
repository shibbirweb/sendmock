import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MailListEmptyState } from "@/features/mail/list/mail-list-empty-state";
import { MailListToolbar } from "@/features/mail/list/mail-list-toolbar";
import { MailSearchBar } from "@/features/mail/list/mail-search-bar";
import { MailVirtualList } from "@/features/mail/list/mail-virtual-list";
import { useMessageProviders } from "@/lib/api/hooks/use-message-provider-queries";
import { parseMailSearch } from "@/features/mail/parse-mail-search";
import {
  useDeleteAllEmails,
  useDeleteEmail,
  useInfiniteEmailList,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";

type MailListPanelProps = {
  searchText: string;
  selectedEmailId: string | undefined;
};

export function MailListPanel({
  searchText,
  selectedEmailId,
}: MailListPanelProps) {
  const navigate = useNavigate({ from: "/mail" });
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const emailProviders = useMessageProviders("email").data;
  const emailFilters = React.useMemo(
    () =>
      parseMailSearch(
        searchText,
        emailProviders?.map((emailProvider) => emailProvider.key),
      ),
    [searchText, emailProviders],
  );
  const emailListQuery = useInfiniteEmailList(emailFilters);
  const deleteEmail = useDeleteEmail();
  const deleteAllEmails = useDeleteAllEmails();
  const updateEmail = useUpdateEmail();
  const [checkedEmailIds, setCheckedEmailIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  const emails = React.useMemo(
    () =>
      emailListQuery.data?.pages.flatMap((emailPage) => emailPage.items) ?? [],
    [emailListQuery.data],
  );
  const totalEmailCount = emailListQuery.data?.pages[0]?.total_count ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = emailListQuery;

  const loadNextPage = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const deleteOneEmail = React.useCallback(
    (emailId: string) => {
      deleteEmail.mutate(emailId);
      toast("Email deleted");
    },
    [deleteEmail],
  );

  const runForCheckedEmails = (emailAction: (emailId: string) => void) => {
    for (const emailId of checkedEmailIds) {
      emailAction(emailId);
    }
    setCheckedEmailIds(new Set());
  };

  const clearSearch = () => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, q: undefined }),
    });
  };

  return (
    <>
      <MailSearchBar searchText={searchText} searchInputRef={searchInputRef} />
      <MailListToolbar
        loadedEmailCount={emails.length}
        totalEmailCount={totalEmailCount}
        checkedEmailCount={checkedEmailIds.size}
        onToggleAllChecked={(isChecked) => {
          setCheckedEmailIds(
            isChecked ? new Set(emails.map((email) => email.id)) : new Set(),
          );
        }}
        onMarkCheckedRead={() => {
          runForCheckedEmails((emailId) => {
            updateEmail.mutate({ emailId, emailUpdate: { is_read: true } });
          });
        }}
        onDeleteChecked={() => {
          const deletedCount = checkedEmailIds.size;
          runForCheckedEmails((emailId) => {
            deleteEmail.mutate(emailId);
          });
          toast(`${deletedCount} emails deleted`);
        }}
        onDeleteAll={() => {
          deleteAllEmails.mutate();
          void navigate({
            to: "/mail",
            search: (previousSearch) => previousSearch,
          });
        }}
      />
      {emailListQuery.isPending ? (
        <div className="grid gap-3 p-3">
          {Array.from({ length: 6 }, (_, skeletonIndex) => (
            <Skeleton key={skeletonIndex} className="h-16 w-full" />
          ))}
        </div>
      ) : emailListQuery.isError ? (
        <QueryErrorState
          message="Could not load emails."
          onRetry={() => void emailListQuery.refetch()}
          className="flex-1 p-6"
        />
      ) : emails.length === 0 ? (
        <MailListEmptyState
          hasActiveSearch={searchText.trim() !== ""}
          onClearSearch={clearSearch}
        />
      ) : (
        <MailVirtualList
          emails={emails}
          selectedEmailId={selectedEmailId}
          checkedEmailIds={checkedEmailIds}
          onCheckedChange={(emailId, isChecked) => {
            setCheckedEmailIds((previousIds) => {
              const nextIds = new Set(previousIds);
              if (isChecked) {
                nextIds.add(emailId);
              } else {
                nextIds.delete(emailId);
              }

              return nextIds;
            });
          }}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadNextPage={loadNextPage}
          onDeleteEmail={deleteOneEmail}
          searchInputRef={searchInputRef}
        />
      )}
    </>
  );
}
