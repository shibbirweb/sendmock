import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import {
  useHttpResponseRules,
  useSaveHttpResponseRules,
} from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpResponseRule } from "@/lib/api/types";

type EditingRule = { editedRule: HttpResponseRule | null } | null;

/** A bin's ordered rules and every change to them, saved as the whole list (HC-02.4). */
export function useResponseRuleList(binId: string) {
  const rulesQuery = useHttpResponseRules(binId);
  const saveHttpResponseRules = useSaveHttpResponseRules();
  const responseRules = rulesQuery.data ?? [];
  const [editingRule, setEditingRule] = React.useState<EditingRule>(null);
  const [deletingRule, setDeletingRule] =
    React.useState<HttpResponseRule | null>(null);

  const saveRules = (
    nextRules: HttpResponseRule[],
    confirmation: string | null,
    onSaved?: () => void,
  ) => {
    saveHttpResponseRules.mutate(
      { binId, responseRules: nextRules },
      {
        onSuccess: () => {
          if (confirmation !== null) {
            toast(confirmation);
          }
          onSaved?.();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the rules",
          );
        },
      },
    );
  };

  return {
    rulesQuery,
    responseRules,
    isSaving: saveHttpResponseRules.isPending,
    editingRule,
    openEditor: (editedRule: HttpResponseRule | null) => {
      setEditingRule({ editedRule });
    },
    closeEditor: () => {
      setEditingRule(null);
    },
    deletingRule,
    askToDelete: setDeletingRule,
    saveEditedRule: (savedRule: HttpResponseRule) => {
      const isNew = editingRule?.editedRule === null;
      const nextRules = isNew
        ? [...responseRules, savedRule]
        : responseRules.map((responseRule) =>
            responseRule.id === savedRule.id ? savedRule : responseRule,
          );
      saveRules(nextRules, isNew ? "Rule added" : "Rule saved", () => {
        setEditingRule(null);
      });
    },
    moveRule: (ruleIndex: number, step: -1 | 1) => {
      const nextRules = [...responseRules];
      const [movedRule] = nextRules.splice(ruleIndex, 1);
      if (movedRule !== undefined) {
        nextRules.splice(ruleIndex + step, 0, movedRule);
        saveRules(nextRules, null);
      }
    },
    toggleRule: (toggledRule: HttpResponseRule, isEnabled: boolean) => {
      saveRules(
        responseRules.map((responseRule) =>
          responseRule.id === toggledRule.id
            ? { ...responseRule, is_enabled: isEnabled }
            : responseRule,
        ),
        null,
      );
    },
    deleteRule: () => {
      if (deletingRule !== null) {
        saveRules(
          responseRules.filter(
            (responseRule) => responseRule.id !== deletingRule.id,
          ),
          "Rule deleted",
        );
      }
      setDeletingRule(null);
    },
  };
}
