import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSelectedProjectKey } from "@/hooks/use-selected-project";
import { requestApi } from "@/lib/api/api-client";
import { buildOpenEventRequest } from "@/lib/api/open-event-request";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  InboundSmsRequest,
  OpenSource,
  PageOf,
  SmsListFilters,
  SmsMessage,
  SmsMessageDetail,
  SmsStatus,
  SmsThread,
} from "@/lib/api/types";

export function useSmsList(smsFilters: SmsListFilters = {}) {
  const projectFilters = { ...smsFilters, project: useSelectedProjectKey() };

  return useQuery({
    queryKey: queryKeys.sms.list(projectFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<SmsMessage>>("/sms", {
        queryParameters: projectFilters,
        abortSignal: signal,
      }),
  });
}

export function useSmsThreads() {
  const projectKey = useSelectedProjectKey();

  return useQuery({
    queryKey: queryKeys.sms.threads(projectKey),
    queryFn: ({ signal }) =>
      requestApi<SmsThread[]>("/sms/threads", {
        queryParameters: { project: projectKey },
        abortSignal: signal,
      }),
  });
}

export function useSmsMessage(smsId: string) {
  return useQuery({
    queryKey: queryKeys.sms.detail(smsId),
    queryFn: ({ signal }) =>
      requestApi<SmsMessageDetail>(`/sms/${smsId}`, { abortSignal: signal }),
  });
}

function useSmsMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sms.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.verify.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

export function useSendInboundSms() {
  return useSmsMutation((inboundSmsRequest: InboundSmsRequest) =>
    requestApi<SmsMessage>("/sms/inbound", {
      method: "POST",
      requestBody: inboundSmsRequest,
    }),
  );
}

export function useSetSmsStatus() {
  return useSmsMutation(
    ({
      smsId,
      smsStatus,
      errorCode = null,
    }: {
      smsId: string;
      smsStatus: SmsStatus;
      errorCode?: string | null;
    }) =>
      requestApi<SmsMessage>(`/sms/${smsId}/status`, {
        method: "POST",
        requestBody: { status: smsStatus, error_code: errorCode },
      }),
  );
}

/** Sends an inbound message to its reply webhook again (SM-09.7). */
export function useResendReplyWebhook() {
  return useSmsMutation((smsId: string) =>
    requestApi<SmsMessage>(`/sms/${smsId}/reply-webhook/resend`, {
      method: "POST",
    }),
  );
}

export function useOpenSms() {
  return useSmsMutation(
    ({ smsId, openSource }: { smsId: string; openSource: OpenSource }) =>
      requestApi<void>(`/sms/${smsId}/open`, {
        method: "POST",
        requestBody: buildOpenEventRequest(openSource),
      }),
  );
}

export function useDeleteAllSms() {
  return useSmsMutation(() => requestApi<void>("/sms", { method: "DELETE" }));
}

export function useDeleteSms() {
  return useSmsMutation((smsId: string) =>
    requestApi<void>(`/sms/${smsId}`, { method: "DELETE" }),
  );
}
