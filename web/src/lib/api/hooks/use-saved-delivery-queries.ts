import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  SavedDelivery,
  SavedDeliverySendRequest,
  WebhookDelivery,
  WebhookTemplateSummary,
} from "@/lib/api/types";

function useSavedMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
  });
}

export function useRenameSavedDelivery() {
  return useSavedMutation(
    ({ savedId, savedName }: { savedId: string; savedName: string }) =>
      requestApi<SavedDelivery>(`/webhooks/saved/${savedId}`, {
        method: "PATCH",
        requestBody: { name: savedName },
      }),
  );
}

export function useDeleteSavedDelivery() {
  return useSavedMutation((savedId: string) =>
    requestApi<null>(`/webhooks/saved/${savedId}`, { method: "DELETE" }),
  );
}

/** Sends a saved request to an endpoint, optionally re-rendered (WH-10.2). */
export function useSendSavedDelivery() {
  return useSavedMutation(
    ({
      savedId,
      sendRequest,
    }: {
      savedId: string;
      sendRequest: SavedDeliverySendRequest;
    }) =>
      requestApi<WebhookDelivery>(`/webhooks/saved/${savedId}/send`, {
        method: "POST",
        requestBody: sendRequest,
      }),
  );
}

export function useSaveAsTemplate() {
  return useSavedMutation(
    ({ savedId, templateName }: { savedId: string; templateName: string }) =>
      requestApi<WebhookTemplateSummary>(
        `/webhooks/saved/${savedId}/template`,
        {
          method: "POST",
          requestBody: { name: templateName },
        },
      ),
  );
}
