import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  InboundSmsRequest,
  NativeSmsRequest,
  OpenSource,
  PageOf,
  SmsListFilters,
  SmsMessage,
  SmsMessageDetail,
  SmsStatus,
  SmsThread,
} from "@/lib/api/types";

export function useSmsList(smsFilters: SmsListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.sms.list(smsFilters),
    queryFn: ({ signal }) =>
      requestApi<PageOf<SmsMessage>>("/sms", {
        queryParameters: smsFilters,
        abortSignal: signal,
      }),
  });
}

export function useSmsThreads() {
  return useQuery({
    queryKey: queryKeys.sms.threads,
    queryFn: ({ signal }) =>
      requestApi<SmsThread[]>("/sms/threads", { abortSignal: signal }),
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

export function useSendSms() {
  return useSmsMutation((nativeSmsRequest: NativeSmsRequest) =>
    requestApi<SmsMessage>("/sms", {
      method: "POST",
      requestBody: nativeSmsRequest,
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

export function useOpenSms() {
  return useSmsMutation(
    ({ smsId, openSource }: { smsId: string; openSource: OpenSource }) =>
      requestApi<void>(`/sms/${smsId}/open`, {
        method: "POST",
        requestBody: { source: openSource },
      }),
  );
}

export function useDeleteSms() {
  return useSmsMutation((smsId: string) =>
    requestApi<void>(`/sms/${smsId}`, { method: "DELETE" }),
  );
}
