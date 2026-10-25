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
  BodyFieldType,
  EndpointBodyMode,
  HttpMethod,
  RenderMode,
  TemplateMode,
  WebhookEndpoint,
  WebhookEndpointInput,
} from "@/lib/api/types";
import { defaultEndpointRequest } from "@/lib/webhooks/endpoint-request-defaults";
import {
  validateWebhookEndpointInput,
  type WebhookEndpointFieldErrors,
} from "@/lib/webhooks/validate-webhook-endpoint";

/** One typed body field row in Fields mode. */
export type BodyFieldRow = {
  rowId: number;
  fieldName: string;
  valueType: BodyFieldType;
  fieldValue: string;
};

/** Form fields as typed; numbers stay text until saving. */
export type WebhookEndpointFormValues = {
  name: string;
  url: string;
  method: HttpMethod;
  timeoutSeconds: string;
  isEnabled: boolean;
  templateId: string;
  templateMode: TemplateMode;
  queryRows: NameValueRow[];
  headerRows: NameValueRow[];
  fieldRows: NameValueRow[];
  bodyMode: EndpointBodyMode;
  bodyFieldRows: BodyFieldRow[];
  fieldsEncoding: "json" | "form";
  rawContentType: string;
  rawBody: string;
  renderMode: RenderMode;
  maxAttempts: string;
  backoffSeconds: number[];
  retryOnClientErrors: boolean;
};

const defaultBackoffSeconds = [1, 5, 30, 120, 600];

function toFormValues(
  webhookEndpoint: WebhookEndpoint | null,
  initialTemplateId: string,
): WebhookEndpointFormValues {
  return {
    name: webhookEndpoint?.name ?? "",
    url: webhookEndpoint?.url ?? "",
    method: webhookEndpoint?.method ?? "POST",
    timeoutSeconds: String((webhookEndpoint?.timeout_ms ?? 10_000) / 1000),
    isEnabled: webhookEndpoint?.is_enabled ?? true,
    templateId: webhookEndpoint?.template_id ?? initialTemplateId,
    templateMode: webhookEndpoint?.template_mode ?? "linked",
    queryRows: (webhookEndpoint?.query_params ?? []).map(
      (queryParam, queryIndex) => ({
        rowId: queryIndex + 1,
        rowName: queryParam.name,
        rowValue: queryParam.value,
      }),
    ),
    headerRows: toNameValueRows(webhookEndpoint?.headers ?? {}),
    fieldRows: toNameValueRows(webhookEndpoint?.extra_fields ?? {}),
    bodyMode: webhookEndpoint?.body_mode ?? defaultEndpointRequest.body_mode,
    bodyFieldRows: (webhookEndpoint?.body_fields ?? []).map(
      (bodyField, fieldIndex) => ({
        rowId: fieldIndex + 1,
        fieldName: bodyField.name,
        valueType: bodyField.value_type,
        fieldValue: bodyField.value,
      }),
    ),
    fieldsEncoding:
      webhookEndpoint?.fields_encoding ??
      defaultEndpointRequest.fields_encoding,
    rawContentType:
      webhookEndpoint?.raw_content_type ??
      defaultEndpointRequest.raw_content_type,
    rawBody: webhookEndpoint?.raw_body ?? defaultEndpointRequest.raw_body,
    renderMode:
      webhookEndpoint?.render_mode ?? defaultEndpointRequest.render_mode,
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
    query_params: formValues.queryRows
      .filter((queryRow) => queryRow.rowName.trim() !== "")
      .map((queryRow) => ({
        name: queryRow.rowName.trim(),
        value: queryRow.rowValue,
      })),
    headers: fromNameValueRows(formValues.headerRows),
    extra_fields: fromNameValueRows(formValues.fieldRows),
    template_id: formValues.templateId,
    template_mode: formValues.templateMode,
    body_mode: formValues.bodyMode,
    body_fields: formValues.bodyFieldRows.map((bodyFieldRow) => ({
      name: bodyFieldRow.fieldName.trim(),
      value_type: bodyFieldRow.valueType,
      value: bodyFieldRow.fieldValue,
    })),
    fields_encoding: formValues.fieldsEncoding,
    raw_content_type: formValues.rawContentType.trim(),
    raw_body: formValues.rawBody,
    render_mode: formValues.renderMode,
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
  initialTemplateId,
  onSaved,
}: {
  editedEndpoint: WebhookEndpoint | null;
  /** The template a new endpoint starts with. */
  initialTemplateId: string;
  onSaved: (savedEndpoint: WebhookEndpoint) => void;
}) {
  const saveWebhookEndpoint = useSaveWebhookEndpoint();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedEndpoint, initialTemplateId),
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
