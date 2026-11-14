import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSaveWebhookVariable } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type {
  VariableKind,
  WebhookVariable,
  WebhookVariableInput,
} from "@/lib/api/types";
import {
  type WebhookVariableFieldErrors,
  validateWebhookVariableInput,
} from "@/lib/webhooks/validate-webhook-variable";

/** Select value for the global scope (Select items cannot be empty). */
export const globalScopeValue = "global";

export type VariableFormValues = {
  name: string;
  /** `globalScopeValue` or an endpoint id. */
  scopeValue: string;
  kind: VariableKind;
  value: string;
  randomMode: "per_send" | "fixed";
  description: string;
};

/** A sensible starting value when the kind changes, so the preview has something to show. */
const startingValuesByKind: Record<VariableKind, string> = {
  text: "",
  number: "0",
  boolean: "true",
  json: "{}",
  secret: "",
  dynamic: "data.subject",
  random: "random_string(16)",
  computed: "{{ vars.tenant_id }}",
  prompt: "",
};

function toFormValues(
  webhookVariable: WebhookVariable | null,
  defaultScopeValue: string,
): VariableFormValues {
  return {
    name: webhookVariable?.name ?? "",
    scopeValue:
      webhookVariable?.endpoint_id ??
      (webhookVariable === null ? defaultScopeValue : globalScopeValue),
    kind: webhookVariable?.kind ?? "text",
    // A stored secret is never sent back, so editing starts empty (keeps it).
    value:
      webhookVariable?.kind === "secret" ? "" : (webhookVariable?.value ?? ""),
    randomMode: webhookVariable?.random_mode ?? "per_send",
    description: webhookVariable?.description ?? "",
  };
}

export function toVariableInput(
  formValues: VariableFormValues,
): WebhookVariableInput {
  const isGlobal = formValues.scopeValue === globalScopeValue;

  return {
    name: formValues.name.trim(),
    kind: formValues.kind,
    scope: isGlobal ? "global" : "endpoint",
    endpoint_id: isGlobal ? null : formValues.scopeValue,
    value: formValues.value,
    random_mode: formValues.kind === "random" ? formValues.randomMode : null,
    description: formValues.description,
  };
}

/** State, per-kind checks (WH-07.12) and saving for the variable sheet. */
export function useVariableForm({
  editedVariable,
  defaultScopeValue,
  otherVariables,
  onSaved,
}: {
  editedVariable: WebhookVariable | null;
  defaultScopeValue: string;
  /** Every variable except the edited one, for the unique-name check. */
  otherVariables: WebhookVariable[];
  onSaved: () => void;
}) {
  const saveWebhookVariable = useSaveWebhookVariable();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedVariable, defaultScopeValue),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<WebhookVariableFieldErrors>({});

  const updateFormValues = (changedValues: Partial<VariableFormValues>) => {
    setFormValues((previousValues) => {
      const isKindChange =
        changedValues.kind !== undefined &&
        changedValues.kind !== previousValues.kind;

      return {
        ...previousValues,
        ...changedValues,
        value: isKindChange
          ? startingValuesByKind[changedValues.kind ?? "text"]
          : (changedValues.value ?? previousValues.value),
      };
    });
  };

  const saveVariable = (renderErrors: string[]) => {
    const variableInput = toVariableInput(formValues);
    const validationErrors = validateWebhookVariableInput(
      variableInput,
      otherVariables,
      editedVariable?.kind === "secret",
    );
    if (validationErrors.value === undefined && renderErrors.length > 0) {
      validationErrors.value = renderErrors[0];
    }
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveWebhookVariable.mutate(
      { variableId: editedVariable?.id ?? null, variableInput },
      {
        onSuccess: () => {
          toast(editedVariable === null ? "Variable added" : "Variable saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the variable",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    isSaving: saveWebhookVariable.isPending,
    saveVariable,
  };
}
