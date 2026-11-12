import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  isEmailSummary,
  placeNewEmailsInLists,
} from "@/features/realtime/email-list-cache-patch";
import type { QueryRefresher } from "@/lib/api/query-refresher";
import {
  listEveryRealtimeQueryKey,
  listQueryKeysToRefresh,
  removeDuplicateQueryKeys,
} from "@/features/realtime/realtime-event-effects";
import { queryKeys } from "@/lib/api/query-keys";
import type { AppEvent, AppEventType, EmailSummary } from "@/lib/api/types";

/** Events whose data is a whole email list row, placed into the lists without a request. */
const newEmailEventTypes: ReadonlySet<AppEventType> = new Set([
  "email.received",
  "email.inbound",
]);

/**
 * Brings the cached queries up to date with one flush of realtime events: new emails go
 * straight into the lists, and each other affected query is refreshed once for the whole flush.
 */
export function applyRealtimeEvents(
  queryClient: QueryClient,
  queryRefresher: QueryRefresher,
  appEvents: AppEvent[],
) {
  const queryKeysToRefresh: QueryKey[] = [];
  const newEmails: EmailSummary[] = [];

  for (const appEvent of appEvents) {
    if (
      newEmailEventTypes.has(appEvent.type) &&
      isEmailSummary(appEvent.data)
    ) {
      newEmails.push(appEvent.data);
      queryKeysToRefresh.push(queryKeys.system.stats);
      continue;
    }
    for (const queryKey of listQueryKeysToRefresh(appEvent.type)) {
      queryKeysToRefresh.push(queryKey);
    }
  }
  if (newEmails.length > 0) {
    for (const listKey of placeNewEmailsInLists(queryClient, newEmails)) {
      queryKeysToRefresh.push(listKey);
    }
  }

  for (const queryKey of removeDuplicateQueryKeys(queryKeysToRefresh)) {
    queryRefresher.refreshQueries(queryKey);
  }
}

/** After the stream comes back, events may have been missed: every list is refreshed once. */
export function refreshAfterReconnect(queryRefresher: QueryRefresher) {
  for (const queryKey of listEveryRealtimeQueryKey()) {
    queryRefresher.refreshQueries(queryKey);
  }
}
