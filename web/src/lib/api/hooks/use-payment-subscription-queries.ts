import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PaymentSubscription,
  PaymentSubscriptionCancelRequest,
  PaymentSubscriptionCreateRequest,
} from "@/lib/api/types";

export function usePaymentSubscriptions() {
  return useQuery({
    queryKey: queryKeys.payments.subscriptions,
    queryFn: ({ signal }) =>
      requestApi<PaymentSubscription[]>("/payments/subscriptions", {
        abortSignal: signal,
      }),
  });
}

/** A change refreshes the subscriptions and the payments its charges made. */
function useSubscriptionMutation<MutationInput>(
  mutationRequest: (
    mutationInput: MutationInput,
  ) => Promise<PaymentSubscription>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
  });
}

export function useCreatePaymentSubscription() {
  return useSubscriptionMutation(
    (createRequest: PaymentSubscriptionCreateRequest) =>
      requestApi<PaymentSubscription>("/payments/subscriptions", {
        method: "POST",
        requestBody: createRequest,
      }),
  );
}

export function useAdvancePaymentSubscription() {
  return useSubscriptionMutation((subscriptionId: string) =>
    requestApi<PaymentSubscription>(
      `/payments/subscriptions/${subscriptionId}/advance`,
      { method: "POST" },
    ),
  );
}

export function useCancelPaymentSubscription() {
  return useSubscriptionMutation(
    ({
      subscriptionId,
      cancelRequest,
    }: {
      subscriptionId: string;
      cancelRequest: PaymentSubscriptionCancelRequest;
    }) =>
      requestApi<PaymentSubscription>(
        `/payments/subscriptions/${subscriptionId}/cancel`,
        { method: "POST", requestBody: cancelRequest },
      ),
  );
}
