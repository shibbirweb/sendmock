import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  EmailDetail,
  EmailListFilters,
  EmailSummary,
  EmailTimelineEntry,
  EmailUpdate,
  NativeSendRequest,
  OpenSource,
  PageOf,
  SimulatedEmailOutcome,
} from "@/lib/api/types";

export function useEmailList(emailFilters: EmailListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.emails.list(emailFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<EmailSummary>>("/emails", {
        queryParameters: emailFilters,
        abortSignal: signal,
      }),
  });
}

/** Email list that loads the next page as the user scrolls. */
export function useInfiniteEmailList(emailFilters: EmailListFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.emails.infiniteList(emailFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<EmailSummary>>("/emails", {
        queryParameters: { ...emailFilters, cursor: pageParam, limit: 50 },
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
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

export function useDeleteAllEmails() {
  return useEmailMutation(() =>
    requestApi<void>("/emails", { method: "DELETE" }),
  );
}

export function useOpenEmail() {
  return useEmailMutation(
    ({ emailId, openSource }: { emailId: string; openSource: OpenSource }) =>
      requestApi<void>(`/emails/${emailId}/open`, {
        method: "POST",
        requestBody: { source: openSource },
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

/** Native HTTP send API (POST /api/v1/send), used for sample emails. */
export function useSendEmail() {
  return useEmailMutation((nativeSendRequest: NativeSendRequest) =>
    requestApi<{ id: string }>("/send", {
      method: "POST",
      requestBody: nativeSendRequest,
    }),
  );
}
