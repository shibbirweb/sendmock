import { useQuery } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  SavedDelivery,
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
