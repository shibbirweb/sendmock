import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  DeliveryListFilters,
  DeliveryReplayRequest,
  PageOf,
  SavedDelivery,
  WebhookDelivery,
  WebhookDeliveryDetail,
} from "@/lib/api/types";

/** Rows per page; the delivery log grows with every event (WH-03.7). */
const deliveryPageSize = 50;

export function useWebhookDeliveries(
  deliveryFilters: DeliveryListFilters = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.webhooks.deliveries(deliveryFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      requestApi<PageOf<WebhookDelivery>>("/webhooks/deliveries", {
        queryParameters: {
          ...deliveryFilters,
          cursor: pageParam,
          limit: deliveryPageSize,
        },
        abortSignal: signal,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useWebhookDelivery(deliveryId: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.delivery(deliveryId),
    queryFn: ({ signal }) =>
      requestApi<WebhookDeliveryDetail>(`/webhooks/deliveries/${deliveryId}`, {
        abortSignal: signal,
      }),
  });
}

function useDeliveryMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

/** Replays as-is, re-rendered, or with an edited body and headers (WH-05.2). */
export function useReplayDelivery() {
  return useDeliveryMutation(
    ({
      deliveryId,
      replayRequest,
    }: {
      deliveryId: string;
      replayRequest: DeliveryReplayRequest;
    }) =>
      requestApi<WebhookDelivery>(`/webhooks/deliveries/${deliveryId}/replay`, {
        method: "POST",
        requestBody: replayRequest,
      }),
  );
}

export function useCancelDeliveryRetries() {
  return useDeliveryMutation((deliveryId: string) =>
    requestApi<WebhookDeliveryDetail>(
      `/webhooks/deliveries/${deliveryId}/cancel`,
      {
        method: "POST",
      },
    ),
  );
}

export function useSaveDelivery() {
  return useDeliveryMutation(
    ({ deliveryId, savedName }: { deliveryId: string; savedName: string }) =>
      requestApi<SavedDelivery>("/webhooks/saved", {
        method: "POST",
        requestBody: { name: savedName, delivery_id: deliveryId },
      }),
  );
}
