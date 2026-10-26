import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ForwardRule,
  ForwardRuleInput,
  MessageRuleMove,
  TagRule,
  TagRuleInput,
} from "@/lib/api/types";

/** `tag-rules` add tags to arriving mail; `forward-rules` release it to real addresses. */
export type MessageRuleKind = "tag-rules" | "forward-rules";

export type MessageRuleTypes = {
  "tag-rules": { rule: TagRule; input: TagRuleInput };
  "forward-rules": { rule: ForwardRule; input: ForwardRuleInput };
};

function readQueryKey(ruleKind: MessageRuleKind) {
  return ruleKind === "tag-rules"
    ? queryKeys.messageRules.tag
    : queryKeys.messageRules.forward;
}

export function useMessageRules<RuleKind extends MessageRuleKind>(
  ruleKind: RuleKind,
) {
  return useQuery({
    queryKey: readQueryKey(ruleKind),
    queryFn: ({ signal }) =>
      requestApi<MessageRuleTypes[RuleKind]["rule"][]>(`/${ruleKind}`, {
        abortSignal: signal,
      }),
  });
}

function useMessageRuleMutation<MutationInput>(
  ruleKind: MessageRuleKind,
  mutationRequest: (mutationInput: MutationInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readQueryKey(ruleKind) });
    },
  });
}

export function useSaveMessageRule<RuleKind extends MessageRuleKind>(
  ruleKind: RuleKind,
) {
  return useMessageRuleMutation(
    ruleKind,
    ({
      ruleId,
      ruleInput,
    }: {
      ruleId: string | null;
      ruleInput: Partial<MessageRuleTypes[RuleKind]["input"]>;
    }) =>
      requestApi(ruleId === null ? `/${ruleKind}` : `/${ruleKind}/${ruleId}`, {
        method: ruleId === null ? "POST" : "PATCH",
        requestBody: ruleInput,
      }),
  );
}

export function useMoveMessageRule(ruleKind: MessageRuleKind) {
  return useMessageRuleMutation(
    ruleKind,
    ({ ruleId, direction }: { ruleId: string } & MessageRuleMove) =>
      requestApi(`/${ruleKind}/${ruleId}/move`, {
        method: "POST",
        requestBody: { direction },
      }),
  );
}

export function useDeleteMessageRule(ruleKind: MessageRuleKind) {
  return useMessageRuleMutation(ruleKind, (ruleId: string) =>
    requestApi(`/${ruleKind}/${ruleId}`, { method: "DELETE" }),
  );
}
