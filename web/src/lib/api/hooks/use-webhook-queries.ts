import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PageOf,
  SavedDelivery,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRule,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: queryKeys.webhooks.endpoints,
    queryFn: ({ signal }) =>
      requestApi<WebhookEndpoint[]>("/webhooks/endpoints", {
        abortSignal: signal,
      }),
  });
}

export function useWebhookRules() {
  return useQuery({
    queryKey: queryKeys.webhooks.rules,
    queryFn: ({ signal }) =>
      requestApi<WebhookRule[]>("/webhooks/rules", { abortSignal: signal }),
  });
}

export function useWebhookDeliveries() {
  return useQuery({
    queryKey: queryKeys.webhooks.deliveries,
    queryFn: ({ signal }) =>
      requestApi<PageOf<WebhookDelivery>>("/webhooks/deliveries", {
        abortSignal: signal,
      }),
  });
}

export function useWebhookTemplates() {
  return useQuery({
    queryKey: queryKeys.webhooks.templates,
    queryFn: ({ signal }) =>
      requestApi<WebhookTemplateSummary[]>("/webhooks/templates", {
        abortSignal: signal,
      }),
  });
}

export function useWebhookVariables() {
  return useQuery({
    queryKey: queryKeys.webhooks.variables,
    queryFn: ({ signal }) =>
      requestApi<WebhookVariable[]>("/webhooks/variables", {
        abortSignal: signal,
      }),
  });
}

export function useSavedDeliveries() {
  return useQuery({
    queryKey: queryKeys.webhooks.saved,
    queryFn: ({ signal }) =>
      requestApi<SavedDelivery[]>("/webhooks/saved", { abortSignal: signal }),
  });
}

export function useReplayDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deliveryId,
      shouldRerender,
    }: {
      deliveryId: string;
      shouldRerender: boolean;
    }) =>
      requestApi<WebhookDelivery>(`/webhooks/deliveries/${deliveryId}/replay`, {
        method: "POST",
        requestBody: { rerender: shouldRerender },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
  });
}
