import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi, requestApiText } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  HtmlCheckReport,
  LinkCheckResult,
  ListUnsubscribeReport,
  MimePart,
  SpamCheckReport,
} from "@/lib/api/types";

/** Queries behind the email detail tabs; each loads only when its tab opens. */

export function useEmailRawSource(emailId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: queryKeys.emails.raw(emailId),
    queryFn: ({ signal }) => requestApiText(`/emails/${emailId}/raw`, signal),
    enabled: isEnabled,
  });
}

export function useEmailMimeTree(emailId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: queryKeys.emails.mime(emailId),
    queryFn: ({ signal }) =>
      requestApi<MimePart>(`/emails/${emailId}/mime`, { abortSignal: signal }),
    enabled: isEnabled,
  });
}

export function useEmailHtmlCheck(emailId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: queryKeys.emails.htmlCheck(emailId),
    queryFn: ({ signal }) =>
      requestApi<HtmlCheckReport>(`/emails/${emailId}/html-check`, {
        abortSignal: signal,
      }),
    enabled: isEnabled,
  });
}

export function useEmailSpamCheck(emailId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: queryKeys.emails.spamCheck(emailId),
    queryFn: () =>
      requestApi<SpamCheckReport>(`/emails/${emailId}/spam-check`, {
        method: "POST",
      }),
    enabled: isEnabled,
  });
}

export function useListUnsubscribeCheck(emailId: string) {
  return useQuery({
    queryKey: queryKeys.emails.listUnsubscribe(emailId),
    queryFn: ({ signal }) =>
      requestApi<ListUnsubscribeReport>(`/emails/${emailId}/list-unsubscribe`, {
        abortSignal: signal,
      }),
  });
}

/** Link checks make outbound requests, so they run only when asked (EM-13.2). */
export function useRunLinkCheck() {
  return useMutation({
    mutationFn: (emailId: string) =>
      requestApi<LinkCheckResult[]>(`/emails/${emailId}/link-check`, {
        method: "POST",
      }),
  });
}

export function useReleaseEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      emailId,
      recipientAddresses,
    }: {
      emailId: string;
      recipientAddresses: string[];
    }) =>
      requestApi<void>(`/emails/${emailId}/release`, {
        method: "POST",
        requestBody: { to: recipientAddresses },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all });
    },
  });
}
