import * as React from "react";
import { toast } from "sonner";

import {
  fromNameValueRows,
  type NameValueRow,
  toNameValueRows,
} from "@/components/common/name-value-rows-editor";
import { ApiError } from "@/lib/api/api-client";
import { useSaveWebhookEndpoint } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type {
  HttpMethod,
  TemplateMode,
  WebhookEndpoint,
  WebhookEndpointInput,
} from "@/lib/api/types";
import {
  validateWebhookEndpointInput,
  type WebhookEndpointFieldErrors,
} from "@/lib/webhooks/validate-webhook-endpoint";

/** Form fields as typed; numbers stay text until saving. */
export type WebhookEndpointFormValues = {
  name: string;
  url: string;
  method: HttpMethod;
  timeoutSeconds: string;
  isEnabled: boolean;
  templateId: string;
  templateMode: TemplateMode;
  headerRows: NameValueRow[];
  fieldRows: NameValueRow[];
  maxAttempts: string;
  backoffSeconds: number[];
  retryOnClientErrors: boolean;
};

const defaultBackoffSeconds = [1, 5, 30, 120, 600];

function toFormValues(
  webhookEndpoint: WebhookEndpoint | null,
): WebhookEndpointFormValues {
  return {
    name: webhookEndpoint?.name ?? "",
    url: webhookEndpoint?.url ?? "",
    method: webhookEndpoint?.method ?? "POST",
    timeoutSeconds: String((webhookEndpoint?.timeout_ms ?? 10_000) / 1000),
    isEnabled: webhookEndpoint?.is_enabled ?? true,
    templateId: webhookEndpoint?.template_id ?? "native",
    templateMode: webhookEndpoint?.template_mode ?? "linked",
    headerRows: toNameValueRows(webhookEndpoint?.headers ?? {}),
    fieldRows: toNameValueRows(webhookEndpoint?.extra_fields ?? {}),
    maxAttempts: String(webhookEndpoint?.retry_policy.max_attempts ?? 5),
    backoffSeconds:
      webhookEndpoint?.retry_policy.backoff_seconds ?? defaultBackoffSeconds,
    retryOnClientErrors:
      webhookEndpoint?.retry_policy.retry_on_client_errors ?? false,
  };
}

export function toEndpointInput(
  formValues: WebhookEndpointFormValues,
): WebhookEndpointInput {
  return {
    name: formValues.name,
    url: formValues.url.trim(),
    method: formValues.method,
    headers: fromNameValueRows(formValues.headerRows),
    extra_fields: fromNameValueRows(formValues.fieldRows),
    template_id: formValues.templateId,
    template_mode: formValues.templateMode,
    timeout_ms: Math.round(Number(formValues.timeoutSeconds) * 1000),
    retry_policy: {
      max_attempts: Number(formValues.maxAttempts),
      backoff_seconds: formValues.backoffSeconds,
      retry_on_client_errors: formValues.retryOnClientErrors,
    },
    is_enabled: formValues.isEnabled,
  };
}

/** State, validation (WH-01.5) and saving for the endpoint sheet. */
export function useWebhookEndpointForm({
  editedEndpoint,
  onSaved,
}: {
  editedEndpoint: WebhookEndpoint | null;
  onSaved: (savedEndpoint: WebhookEndpoint) => void;
}) {
  const saveWebhookEndpoint = useSaveWebhookEndpoint();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedEndpoint),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<WebhookEndpointFieldErrors>({});

  const updateFormValues = (
    changedValues: Partial<WebhookEndpointFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  /** Validates and saves; returns the field errors that stopped the save. */
  const saveEndpoint = (): WebhookEndpointFieldErrors => {
    const endpointInput = toEndpointInput(formValues);
    const validationErrors = validateWebhookEndpointInput(endpointInput);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return validationErrors;
    }

    saveWebhookEndpoint.mutate(
      { endpointId: editedEndpoint?.id ?? null, endpointInput },
      {
        onSuccess: (savedEndpoint) => {
          toast(editedEndpoint === null ? "Endpoint added" : "Endpoint saved");
          onSaved(savedEndpoint);
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the endpoint",
          );
        },
      },
    );

    return validationErrors;
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    isSaving: saveWebhookEndpoint.isPending,
    saveEndpoint,
  };
}
