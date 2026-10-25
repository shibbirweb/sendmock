import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  VariablePreviewRequest,
  VariablePreviewResult,
  WebhookVariable,
} from "@/lib/api/types";

/** What a variable resolves to against the sample message (WH-07.12). */
export function useVariablePreview(previewRequest: VariablePreviewRequest) {
  return useQuery({
    queryKey: queryKeys.webhooks.variablePreview(previewRequest),
    queryFn: ({ signal }) =>
      requestApi<VariablePreviewResult>("/webhooks/variables/preview", {
        method: "POST",
        requestBody: previewRequest,
        abortSignal: signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Generates a new value for a Fixed random variable (WH-07.13). */
export function useRegenerateVariable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variableId: string) =>
      requestApi<WebhookVariable>(
        `/webhooks/variables/${variableId}/regenerate`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhooks.variables,
      });
    },
  });
}
