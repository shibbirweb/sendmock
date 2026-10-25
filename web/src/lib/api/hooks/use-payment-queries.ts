import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PageOf,
  PaymentDetail,
  PaymentListFilters,
  PaymentSimulateRequest,
  PaymentSummary,
} from "@/lib/api/types";

/** Rows per page of the payments list (PY-09.1). */
const paymentPageSize = 50;

export function usePayments(paymentFilters: PaymentListFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.payments.list(paymentFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<PaymentSummary>>("/payments", {
        queryParameters: {
          ...paymentFilters,
          cursor: pageParam,
          limit: paymentPageSize,
        },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function usePayment(paymentId: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(paymentId),
    queryFn: ({ signal }) =>
      requestApi<PaymentDetail>(`/payments/${paymentId}`, {
        abortSignal: signal,
      }),
  });
}

function usePaymentMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<PaymentDetail>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: (updatedPayment) => {
      queryClient.setQueryData(
        queryKeys.payments.detail(updatedPayment.id),
        updatedPayment,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

/** Runs a Simulate action; the updated payment comes back at once (PY-09.3). */
export function useSimulatePayment() {
  return usePaymentMutation(
    ({
      paymentId,
      simulateRequest,
    }: {
      paymentId: string;
      simulateRequest: PaymentSimulateRequest;
    }) =>
      requestApi<PaymentDetail>(`/payments/${paymentId}/simulate`, {
        method: "POST",
        requestBody: simulateRequest,
      }),
  );
}

/** Sends the payment's last notification again (PY-08.3). */
export function useResendPaymentNotification() {
  return usePaymentMutation((paymentId: string) =>
    requestApi<PaymentDetail>(`/payments/${paymentId}/notify`, {
      method: "POST",
    }),
  );
}
