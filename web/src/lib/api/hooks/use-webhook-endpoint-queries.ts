import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  RevealedEndpointSecret,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookVariable,
  WebhookVariableInput,
} from "@/lib/api/types";

function useWebhookMutation<MutationInput, MutationResult>(
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

/** Creates an endpoint when `endpointId` is null, else updates it. */
export function useSaveWebhookEndpoint() {
  return useWebhookMutation(
    ({
      endpointId,
      endpointInput,
    }: {
      endpointId: string | null;
      endpointInput: Partial<WebhookEndpointInput>;
    }) =>
      endpointId === null
        ? requestApi<WebhookEndpoint>("/webhooks/endpoints", {
            method: "POST",
            requestBody: endpointInput,
          })
        : requestApi<WebhookEndpoint>(`/webhooks/endpoints/${endpointId}`, {
            method: "PATCH",
            requestBody: endpointInput,
          }),
  );
}

export function useDeleteWebhookEndpoint() {
  return useWebhookMutation((endpointId: string) =>
    requestApi<null>(`/webhooks/endpoints/${endpointId}`, {
      method: "DELETE",
    }),
  );
}

/** Sends `test.ping` and returns the recorded delivery (WH-01.2). */
export function useTestWebhookEndpoint() {
  return useWebhookMutation((endpointId: string) =>
    requestApi<WebhookDelivery>(`/webhooks/endpoints/${endpointId}/test`, {
      method: "POST",
    }),
  );
}

/** Reveals the plain secret, only after the user confirmed (WH-01.3). */
export function useRevealEndpointSecret() {
  return useMutation({
    mutationFn: (endpointId: string) =>
      requestApi<RevealedEndpointSecret>(
        `/webhooks/endpoints/${endpointId}/secret`,
      ),
  });
}

export function useRotateEndpointSecret() {
  return useWebhookMutation(
    ({
      endpointId,
      overlapHours,
    }: {
      endpointId: string;
      overlapHours: number;
    }) =>
      requestApi<WebhookEndpoint>(
        `/webhooks/endpoints/${endpointId}/rotate-secret`,
        { method: "POST", requestBody: { overlap_hours: overlapHours } },
      ),
  );
}

/** Creates a variable when `variableId` is null, else updates it. */
export function useSaveWebhookVariable() {
  return useWebhookMutation(
    ({
      variableId,
      variableInput,
    }: {
      variableId: string | null;
      variableInput: WebhookVariableInput;
    }) =>
      variableId === null
        ? requestApi<WebhookVariable>("/webhooks/variables", {
            method: "POST",
            requestBody: variableInput,
          })
        : requestApi<WebhookVariable>(`/webhooks/variables/${variableId}`, {
            method: "PATCH",
            requestBody: variableInput,
          }),
  );
}

export function useDeleteWebhookVariable() {
  return useWebhookMutation((variableId: string) =>
    requestApi<null>(`/webhooks/variables/${variableId}`, { method: "DELETE" }),
  );
}
