import { useQuery } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { useIsOperationQueryable } from "@/lib/api/hooks/use-operation-availability";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  SavedDelivery,
  WebhookEndpoint,
  WebhookRule,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";

export function useWebhookEndpoints() {
  const isQueryable = useIsOperationQueryable("GET /api/v1/webhooks/endpoints");

  return useQuery({
    queryKey: queryKeys.webhooks.endpoints,
    queryFn: ({ signal }) =>
      requestApi<WebhookEndpoint[]>("/webhooks/endpoints", {
        abortSignal: signal,
      }),
    enabled: isQueryable,
  });
}

export function useWebhookRules() {
  const isQueryable = useIsOperationQueryable("GET /api/v1/webhooks/rules");

  return useQuery({
    queryKey: queryKeys.webhooks.rules,
    queryFn: ({ signal }) =>
      requestApi<WebhookRule[]>("/webhooks/rules", { abortSignal: signal }),
    enabled: isQueryable,
  });
}

export function useWebhookTemplates() {
  const isQueryable = useIsOperationQueryable("GET /api/v1/webhooks/templates");

  return useQuery({
    queryKey: queryKeys.webhooks.templates,
    queryFn: ({ signal }) =>
      requestApi<WebhookTemplateSummary[]>("/webhooks/templates", {
        abortSignal: signal,
      }),
    enabled: isQueryable,
  });
}

export function useWebhookVariables() {
  const isQueryable = useIsOperationQueryable("GET /api/v1/webhooks/variables");

  return useQuery({
    queryKey: queryKeys.webhooks.variables,
    queryFn: ({ signal }) =>
      requestApi<WebhookVariable[]>("/webhooks/variables", {
        abortSignal: signal,
      }),
    enabled: isQueryable,
  });
}

export function useSavedDeliveries() {
  const isQueryable = useIsOperationQueryable("GET /api/v1/webhooks/saved");

  return useQuery({
    queryKey: queryKeys.webhooks.saved,
    queryFn: ({ signal }) =>
      requestApi<SavedDelivery[]>("/webhooks/saved", { abortSignal: signal }),
    enabled: isQueryable,
  });
}
