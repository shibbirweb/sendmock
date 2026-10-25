import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  MessagingService,
  MessagingServiceInput,
  VirtualNumber,
  VirtualNumberInput,
} from "@/lib/api/types";

export function useVirtualNumbers() {
  return useQuery({
    queryKey: queryKeys.numbers.virtualNumbers,
    queryFn: ({ signal }) =>
      requestApi<VirtualNumber[]>("/numbers", { abortSignal: signal }),
  });
}

export function useMessagingServices() {
  return useQuery({
    queryKey: queryKeys.numbers.messagingServices,
    queryFn: ({ signal }) =>
      requestApi<MessagingService[]>("/messaging-services", {
        abortSignal: signal,
      }),
  });
}

/** Numbers and services share the pool, so every change refreshes both. */
function useNumbersMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.numbers.all });
    },
  });
}

export function useSaveVirtualNumber() {
  return useNumbersMutation(
    ({
      numberId,
      numberInput,
    }: {
      numberId: string | null;
      numberInput: VirtualNumberInput;
    }) =>
      numberId === null
        ? requestApi<VirtualNumber>("/numbers", {
            method: "POST",
            requestBody: numberInput,
          })
        : requestApi<VirtualNumber>(`/numbers/${numberId}`, {
            method: "PATCH",
            requestBody: numberInput,
          }),
  );
}

export function useDeleteVirtualNumber() {
  return useNumbersMutation((numberId: string) =>
    requestApi<void>(`/numbers/${numberId}`, { method: "DELETE" }),
  );
}

export function useSaveMessagingService() {
  return useNumbersMutation(
    ({
      serviceSid,
      serviceInput,
    }: {
      serviceSid: string | null;
      serviceInput: MessagingServiceInput;
    }) =>
      serviceSid === null
        ? requestApi<MessagingService>("/messaging-services", {
            method: "POST",
            requestBody: serviceInput,
          })
        : requestApi<MessagingService>(`/messaging-services/${serviceSid}`, {
            method: "PATCH",
            requestBody: serviceInput,
          }),
  );
}

export function useDeleteMessagingService() {
  return useNumbersMutation((serviceSid: string) =>
    requestApi<void>(`/messaging-services/${serviceSid}`, { method: "DELETE" }),
  );
}
