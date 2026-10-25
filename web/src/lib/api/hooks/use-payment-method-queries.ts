import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PaymentMethodDefinition,
  PaymentMethodInput,
} from "@/lib/api/types";

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.payments.methods,
    queryFn: ({ signal }) =>
      requestApi<PaymentMethodDefinition[]>("/payments/methods", {
        abortSignal: signal,
      }),
  });
}

function useMethodMutation<MutationInput, MutationResult>(
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

/** Creates a method when `isNew`, else saves the existing one (PY-12.1). */
export function useSavePaymentMethod() {
  return useMethodMutation(
    ({
      methodInput,
      isNew,
    }: {
      methodInput: PaymentMethodInput;
      isNew: boolean;
    }) =>
      isNew
        ? requestApi<PaymentMethodDefinition>("/payments/methods", {
            method: "POST",
            requestBody: methodInput,
          })
        : requestApi<PaymentMethodDefinition>(
            `/payments/methods/${methodInput.key}`,
            { method: "PATCH", requestBody: methodInput },
          ),
  );
}

export function useResetPaymentMethod() {
  return useMethodMutation((methodKey: string) =>
    requestApi<PaymentMethodDefinition>(
      `/payments/methods/${methodKey}/reset`,
      {
        method: "POST",
      },
    ),
  );
}

export function useDeletePaymentMethod() {
  return useMethodMutation((methodKey: string) =>
    requestApi<null>(`/payments/methods/${methodKey}`, { method: "DELETE" }),
  );
}
