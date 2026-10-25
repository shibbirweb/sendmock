import * as React from "react";
import { toast } from "sonner";

import {
  useDeleteWebhookRule,
  useMoveWebhookRule,
  useSaveWebhookRule,
} from "@/lib/api/hooks/use-webhook-rule-queries";
import type { WebhookRule } from "@/lib/api/types";

/** Sheet, delete, reorder and switch state for the rules screen. */
export function useWebhookRuleActions() {
  const saveWebhookRule = useSaveWebhookRule();
  const deleteWebhookRule = useDeleteWebhookRule();
  const moveWebhookRule = useMoveWebhookRule();
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [editedRule, setEditedRule] = React.useState<WebhookRule | null>(null);
  const [deletedRule, setDeletedRule] = React.useState<WebhookRule | null>(
    null,
  );

  return {
    isSheetOpen,
    setSheetOpen,
    editedRule,
    deletedRule,
    setDeletedRule,
    openSheet: (webhookRule: WebhookRule | null) => {
      setEditedRule(webhookRule);
      setSheetOpen(true);
    },
    moveRule: (webhookRule: WebhookRule, direction: "up" | "down") => {
      moveWebhookRule.mutate({ ruleId: webhookRule.id, direction });
    },
    toggleEnabled: (webhookRule: WebhookRule, isEnabled: boolean) => {
      saveWebhookRule.mutate(
        { ruleId: webhookRule.id, ruleInput: { is_enabled: isEnabled } },
        {
          onSuccess: () => {
            toast(`${webhookRule.name} ${isEnabled ? "enabled" : "disabled"}`);
          },
          onError: () => {
            toast.error("Could not change the rule");
          },
        },
      );
    },
    confirmDelete: () => {
      if (deletedRule === null) {
        return;
      }

      deleteWebhookRule.mutate(deletedRule.id, {
        onSuccess: () => {
          toast("Rule deleted");
        },
      });
    },
  };
}
