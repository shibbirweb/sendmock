import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  RulePreviewRequest,
  RulePreviewResult,
  WebhookRule,
  WebhookRuleInput,
} from "@/lib/api/types";

function useRuleMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.webhooks.rules,
      });
    },
  });
}

/** Creates a rule when `ruleId` is null, else updates it. */
export function useSaveWebhookRule() {
  return useRuleMutation(
    ({
      ruleId,
      ruleInput,
    }: {
      ruleId: string | null;
      ruleInput: Partial<WebhookRuleInput>;
    }) =>
      ruleId === null
        ? requestApi<WebhookRule>("/webhooks/rules", {
            method: "POST",
            requestBody: ruleInput,
          })
        : requestApi<WebhookRule>(`/webhooks/rules/${ruleId}`, {
            method: "PATCH",
            requestBody: ruleInput,
          }),
  );
}

export function useDeleteWebhookRule() {
  return useRuleMutation((ruleId: string) =>
    requestApi<null>(`/webhooks/rules/${ruleId}`, { method: "DELETE" }),
  );
}

export function useMoveWebhookRule() {
  return useRuleMutation(
    ({ ruleId, direction }: { ruleId: string; direction: "up" | "down" }) =>
      requestApi<WebhookRule[]>(`/webhooks/rules/${ruleId}/move`, {
        method: "POST",
        requestBody: { direction },
      }),
  );
}

/** Which of the last 50 messages a filter matches; keeps the last result while typing (WH-02.3). */
export function useRulePreview(
  previewRequest: RulePreviewRequest,
  isEnabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.webhooks.rulePreview(previewRequest),
    queryFn: ({ signal }) =>
      requestApi<RulePreviewResult>("/webhooks/rules/preview", {
        method: "POST",
        requestBody: previewRequest,
        abortSignal: signal,
      }),
    enabled: isEnabled,
    placeholderData: keepPreviousData,
  });
}
