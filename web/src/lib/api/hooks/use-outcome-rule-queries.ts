import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  EmailOutcomeRule,
  EmailOutcomeRuleInput,
  OutcomeRuleMove,
  SmsOutcomeRule,
  SmsOutcomeRuleInput,
} from "@/lib/api/types";

/** `sms` for custom outcome numbers, `email` for custom outcome addresses. */
export type OutcomeRuleKind = "sms" | "email";

type RuleTypes = {
  sms: { rule: SmsOutcomeRule; input: SmsOutcomeRuleInput };
  email: { rule: EmailOutcomeRule; input: EmailOutcomeRuleInput };
};

export function useOutcomeRules<RuleKind extends OutcomeRuleKind>(
  ruleKind: RuleKind,
) {
  return useQuery({
    queryKey: queryKeys.outcomeRules[ruleKind],
    queryFn: ({ signal }) =>
      requestApi<RuleTypes[RuleKind]["rule"][]>(`/outcome-rules/${ruleKind}`, {
        abortSignal: signal,
      }),
  });
}

function useOutcomeRuleMutation<MutationInput, MutationResult>(
  ruleKind: OutcomeRuleKind,
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.outcomeRules[ruleKind],
      });
    },
  });
}

export function useSaveOutcomeRule<RuleKind extends OutcomeRuleKind>(
  ruleKind: RuleKind,
) {
  return useOutcomeRuleMutation(
    ruleKind,
    ({
      ruleId,
      ruleInput,
    }: {
      ruleId: string | null;
      ruleInput: RuleTypes[RuleKind]["input"];
    }) =>
      ruleId === null
        ? requestApi<RuleTypes[RuleKind]["rule"]>(
            `/outcome-rules/${ruleKind}`,
            {
              method: "POST",
              requestBody: ruleInput,
            },
          )
        : requestApi<RuleTypes[RuleKind]["rule"]>(
            `/outcome-rules/${ruleKind}/${ruleId}`,
            {
              method: "PATCH",
              requestBody: ruleInput,
            },
          ),
  );
}

/** Switches a rule on or off without touching its other fields. */
export function useToggleOutcomeRule(ruleKind: OutcomeRuleKind) {
  return useOutcomeRuleMutation(
    ruleKind,
    ({ ruleId, isEnabled }: { ruleId: string; isEnabled: boolean }) =>
      requestApi<unknown>(`/outcome-rules/${ruleKind}/${ruleId}`, {
        method: "PATCH",
        requestBody: { is_enabled: isEnabled },
      }),
  );
}

export function useMoveOutcomeRule(ruleKind: OutcomeRuleKind) {
  return useOutcomeRuleMutation(
    ruleKind,
    ({ ruleId, direction }: { ruleId: string } & OutcomeRuleMove) =>
      requestApi<unknown>(`/outcome-rules/${ruleKind}/${ruleId}/move`, {
        method: "POST",
        requestBody: { direction },
      }),
  );
}

export function useDeleteOutcomeRule(ruleKind: OutcomeRuleKind) {
  return useOutcomeRuleMutation(ruleKind, (ruleId: string) =>
    requestApi<void>(`/outcome-rules/${ruleKind}/${ruleId}`, {
      method: "DELETE",
    }),
  );
}
