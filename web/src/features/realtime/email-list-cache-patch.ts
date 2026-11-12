import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { EmailListFilters, EmailSummary, PageOf } from "@/lib/api/types";

type EmailPage = PageOf<EmailSummary>;

/** Filters a new email can be placed under without asking the server whether it matches. */
const placeableFilterNames = new Set(["project", "limit"]);

/** Whether event data holds a whole list row (the server sends one; older mocks sent less). */
export function isEmailSummary(eventData: unknown): eventData is EmailSummary {
  if (typeof eventData !== "object" || eventData === null) {
    return false;
  }
  const emailFields = eventData as Partial<EmailSummary>;

  return (
    typeof emailFields.id === "string" &&
    typeof emailFields.received_at === "string" &&
    typeof emailFields.subject === "string" &&
    typeof emailFields.from === "object" &&
    emailFields.from !== null &&
    Array.isArray(emailFields.to) &&
    Array.isArray(emailFields.tags)
  );
}

function readEmailFilters(queryKey: QueryKey): EmailListFilters {
  const emailFilters = queryKey[2];

  return typeof emailFilters === "object" && emailFilters !== null
    ? (emailFilters as EmailListFilters)
    : {};
}

function hasOnlyPlaceableFilters(emailFilters: EmailListFilters): boolean {
  return Object.entries(emailFilters).every(
    ([filterName, filterValue]) =>
      filterValue === undefined || placeableFilterNames.has(filterName),
  );
}

/** The new emails a list shows, newest first, leaving out those of another project. */
function selectEmailsForList(
  newEmails: EmailSummary[],
  emailFilters: EmailListFilters,
): EmailSummary[] {
  return newEmails
    .filter(
      (newEmail) =>
        emailFilters.project === undefined ||
        emailFilters.project === newEmail.project,
    )
    .reverse();
}

function prependToPage(
  emailPage: EmailPage,
  emailsToAdd: EmailSummary[],
  knownEmailIds: Set<string>,
): EmailPage {
  const addedEmails = emailsToAdd.filter(
    (emailToAdd) => !knownEmailIds.has(emailToAdd.id),
  );

  return {
    ...emailPage,
    items: [...addedEmails, ...emailPage.items],
    total_count: emailPage.total_count + addedEmails.length,
  };
}

/**
 * Puts new emails at the top of the infinite list's first page. The page is not trimmed: each
 * page's `next_cursor` continues after its own last item, so trimming would hide emails until
 * the next refetch; the list is virtualized, so a longer first page costs little.
 */
function patchInfiniteList(
  infiniteData: InfiniteData<EmailPage> | undefined,
  emailsToAdd: EmailSummary[],
): InfiniteData<EmailPage> | undefined {
  const firstPage = infiniteData?.pages[0];
  if (infiniteData === undefined || firstPage === undefined) {
    return infiniteData;
  }
  const knownEmailIds = new Set(
    infiniteData.pages.flatMap((emailPage) =>
      emailPage.items.map((email) => email.id),
    ),
  );

  return {
    ...infiniteData,
    pages: [
      prependToPage(firstPage, emailsToAdd, knownEmailIds),
      ...infiniteData.pages.slice(1),
    ],
  };
}

/** Puts new emails at the top of a one-page list, trimmed back to its `limit`. */
function patchSinglePageList(
  emailPage: EmailPage | undefined,
  emailsToAdd: EmailSummary[],
  pageLimit: number,
): EmailPage | undefined {
  if (emailPage === undefined) {
    return emailPage;
  }
  const knownEmailIds = new Set(emailPage.items.map((email) => email.id));
  const patchedPage = prependToPage(emailPage, emailsToAdd, knownEmailIds);

  return { ...patchedPage, items: patchedPage.items.slice(0, pageLimit) };
}

/**
 * Writes new emails straight into the cached email lists, as Mailpit puts each new message
 * into the list it holds, so a burst of mail needs no list request. Returns the keys of the
 * lists it could not patch (a search or another filter decides membership on the server).
 */
export function placeNewEmailsInLists(
  queryClient: QueryClient,
  newEmails: EmailSummary[],
): QueryKey[] {
  const listKeysToRefresh: QueryKey[] = [];
  const infiniteListQueries = queryClient.getQueriesData<
    InfiniteData<EmailPage>
  >({ queryKey: queryKeys.emails.infiniteLists });
  for (const [queryKey] of infiniteListQueries) {
    const emailFilters = readEmailFilters(queryKey);
    if (!hasOnlyPlaceableFilters(emailFilters)) {
      listKeysToRefresh.push(queryKey);
      continue;
    }
    const emailsToAdd = selectEmailsForList(newEmails, emailFilters);
    queryClient.setQueryData<InfiniteData<EmailPage>>(
      queryKey,
      (infiniteData) => patchInfiniteList(infiniteData, emailsToAdd),
    );
  }

  const singlePageQueries = queryClient.getQueriesData<EmailPage>({
    queryKey: queryKeys.emails.lists,
  });
  for (const [queryKey] of singlePageQueries) {
    const emailFilters = readEmailFilters(queryKey);
    const pageLimit = emailFilters.limit;
    if (!hasOnlyPlaceableFilters(emailFilters) || pageLimit === undefined) {
      listKeysToRefresh.push(queryKey);
      continue;
    }
    const emailsToAdd = selectEmailsForList(newEmails, emailFilters);
    queryClient.setQueryData<EmailPage>(queryKey, (emailPage) =>
      patchSinglePageList(emailPage, emailsToAdd, pageLimit),
    );
  }

  return listKeysToRefresh;
}
