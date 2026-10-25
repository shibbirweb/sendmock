import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { PaymentFlowDefinition, PaymentFlowInput } from "@/lib/api/types";

export function usePaymentFlows() {
  return useQuery({
    queryKey: queryKeys.payments.flows,
    queryFn: ({ signal }) =>
      requestApi<PaymentFlowDefinition[]>("/payments/flows", {
        abortSignal: signal,
      }),
  });
}

function useFlowMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    },
  });
}

/** Creates a flow when `isNew`, else saves the existing one (PY-12.6). */
export function useSavePaymentFlow() {
  return useFlowMutation(
    ({ flowInput, isNew }: { flowInput: PaymentFlowInput; isNew: boolean }) =>
      isNew
        ? requestApi<PaymentFlowDefinition>("/payments/flows", {
            method: "POST",
            requestBody: flowInput,
          })
        : requestApi<PaymentFlowDefinition>(
            `/payments/flows/${flowInput.key}`,
            { method: "PATCH", requestBody: flowInput },
          ),
  );
}

export function useResetPaymentFlow() {
  return useFlowMutation((flowKey: string) =>
    requestApi<PaymentFlowDefinition>(`/payments/flows/${flowKey}/reset`, {
      method: "POST",
    }),
  );
}

export function useDeletePaymentFlow() {
  return useFlowMutation((flowKey: string) =>
    requestApi<null>(`/payments/flows/${flowKey}`, { method: "DELETE" }),
  );
}
