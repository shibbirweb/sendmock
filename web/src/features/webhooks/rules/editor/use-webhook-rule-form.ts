import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSaveWebhookRule } from "@/lib/api/hooks/use-webhook-rule-queries";
import type {
  AppEventType,
  WebhookRule,
  WebhookRuleInput,
} from "@/lib/api/types";
import {
  type BuilderGroup,
  createNodeIdGenerator,
  toBuilderTree,
  toRuleFilter,
} from "@/lib/webhooks/rule-filter/builder-tree";
import {
  validateWebhookRuleInput,
  type WebhookRuleFieldErrors,
} from "@/lib/webhooks/rule-filter/validate-rule-filter";

export type WebhookRuleFormValues = {
  name: string;
  endpointId: string;
  events: AppEventType[];
  rootGroup: BuilderGroup;
  isEnabled: boolean;
};

function toFormValues(
  webhookRule: WebhookRule | null,
  defaultEndpointId: string,
): WebhookRuleFormValues {
  return {
    name: webhookRule?.name ?? "",
    endpointId: webhookRule?.endpoint_id ?? defaultEndpointId,
    events: webhookRule?.events ?? ["email.received"],
    rootGroup: toBuilderTree(
      webhookRule?.filter ?? null,
      createNodeIdGenerator(),
    ),
    isEnabled: webhookRule?.is_enabled ?? true,
  };
}

export function toRuleInput(
  formValues: WebhookRuleFormValues,
): WebhookRuleInput {
  return {
    name: formValues.name,
    endpoint_id: formValues.endpointId,
    events: formValues.events,
    filter: toRuleFilter(formValues.rootGroup),
    is_enabled: formValues.isEnabled,
  };
}

/** State, validation (WH-02.5) and saving for the rule editor. */
export function useWebhookRuleForm({
  editedRule,
  defaultEndpointId,
  onSaved,
}: {
  editedRule: WebhookRule | null;
  defaultEndpointId: string;
  onSaved: () => void;
}) {
  const saveWebhookRule = useSaveWebhookRule();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedRule, defaultEndpointId),
  );
  const [fieldErrors, setFieldErrors] = React.useState<WebhookRuleFieldErrors>(
    {},
  );
  const [hasTriedSaving, setHasTriedSaving] = React.useState(false);

  const updateFormValues = React.useCallback(
    (changedValues: Partial<WebhookRuleFormValues>) => {
      setFormValues((previousValues) => ({
        ...previousValues,
        ...changedValues,
      }));
    },
    [],
  );

  const saveRule = () => {
    const ruleInput = toRuleInput(formValues);
    const validationErrors = validateWebhookRuleInput(ruleInput);
    setFieldErrors(validationErrors);
    setHasTriedSaving(true);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveWebhookRule.mutate(
      { ruleId: editedRule?.id ?? null, ruleInput },
      {
        onSuccess: () => {
          toast(editedRule === null ? "Rule added" : "Rule saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the rule",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    hasTriedSaving,
    isSaving: saveWebhookRule.isPending,
    saveRule,
  };
}
