import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import { requestApi } from "@/lib/api/api-client";
import { buildOpenEventRequest } from "@/lib/api/open-event-request";
import { queryKeys } from "@/lib/api/query-keys";
import { getQueryRefresher } from "@/lib/api/query-refresher";
import type {
  EmailDetail,
  EmailListFilters,
  EmailSummary,
  EmailTimelineEntry,
  EmailUpdate,
  OpenSource,
  PageOf,
  SimulatedEmailOutcome,
  WebhookChoice,
} from "@/lib/api/types";

export function useEmailList(emailFilters: EmailListFilters = {}) {
  const projectFilters = { ...emailFilters, project: useSelectedProjectKey() };

  return useQuery({
    queryKey: queryKeys.emails.list(projectFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<EmailSummary>>("/emails", {
        queryParameters: projectFilters,
        abortSignal: signal,
      }),
  });
}

/** Email list that loads the next page as the user scrolls. */
export function useInfiniteEmailList(emailFilters: EmailListFilters = {}) {
  const projectFilters = { ...emailFilters, project: useSelectedProjectKey() };

  return useInfiniteQuery({
    queryKey: queryKeys.emails.infiniteList(projectFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<EmailSummary>>("/emails", {
        queryParameters: { ...projectFilters, cursor: pageParam, limit: 50 },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useEmail(emailId: string) {
  return useQuery({
    queryKey: queryKeys.emails.detail(emailId),
    queryFn: ({ signal }) =>
      requestApi<EmailDetail>(`/emails/${emailId}`, { abortSignal: signal }),
  });
}

export function useEmailTimeline(emailId: string) {
  return useQuery({
    queryKey: queryKeys.emails.timeline(emailId),
    queryFn: ({ signal }) =>
      requestApi<EmailTimelineEntry[]>(`/emails/${emailId}/timeline`, {
        abortSignal: signal,
      }),
  });
}

/** Shared by every email mutation: refresh all email queries afterwards. */
function useEmailMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      // Without cancelling: a live refresh of a list may be running (PL-02.3).
      const queryRefresher = getQueryRefresher(queryClient);
      queryRefresher.refreshQueries(queryKeys.emails.all);
      queryRefresher.refreshQueries(queryKeys.system.stats);
    },
  });
}

export function useUpdateEmail() {
  return useEmailMutation(
    ({ emailId, emailUpdate }: { emailId: string; emailUpdate: EmailUpdate }) =>
      requestApi<EmailSummary>(`/emails/${emailId}`, {
        method: "PATCH",
        requestBody: emailUpdate,
      }),
  );
}

export function useDeleteEmail() {
  return useEmailMutation((emailId: string) =>
    requestApi<void>(`/emails/${emailId}`, { method: "DELETE" }),
  );
}

/** Deletes the emails the filters list, or every email when there are none (EM-03.5). */
export function useDeleteAllEmails() {
  return useEmailMutation((emailFilters: EmailListFilters = {}) =>
    requestApi<void>("/emails", {
      method: "DELETE",
      queryParameters: emailFilters,
    }),
  );
}

export function useOpenEmail() {
  return useEmailMutation(
    ({
      emailId,
      openSource,
      webhookChoice,
    }: {
      emailId: string;
      openSource: OpenSource;
      webhookChoice?: WebhookChoice;
    }) =>
      requestApi<void>(`/emails/${emailId}/open`, {
        method: "POST",
        requestBody: { ...buildOpenEventRequest(openSource), ...webhookChoice },
      }),
  );
}

/** Records a click on one of the email's links and fires `email.clicked` (EM-20). */
export function useClickEmailLink() {
  return useEmailMutation(
    ({
      emailId,
      url,
      clickSource,
      webhookChoice,
    }: {
      emailId: string;
      url: string;
      clickSource: OpenSource;
      webhookChoice?: WebhookChoice;
    }) =>
      requestApi<void>(`/emails/${emailId}/clicks`, {
        method: "POST",
        requestBody: {
          url,
          ...buildOpenEventRequest(clickSource),
          ...webhookChoice,
        },
      }),
  );
}

export function useSimulateEmailOutcome() {
  return useEmailMutation(
    ({
      emailId,
      simulatedOutcome,
    }: {
      emailId: string;
      simulatedOutcome: SimulatedEmailOutcome;
    }) =>
      requestApi<void>(`/emails/${emailId}/simulate`, {
        method: "POST",
        requestBody: simulatedOutcome,
      }),
  );
}
