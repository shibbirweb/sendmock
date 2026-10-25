import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { toNameValueRows } from "@/components/common/name-value-rows-editor";
import { useEndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/use-endpoint-request-preview";
import {
  toEndpointInput,
  toFormValues,
  type WebhookEndpointFormValues,
} from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import { useSendVariables } from "@/features/webhooks/send/use-send-variables";
import { ApiError, requestApi } from "@/lib/api/api-client";
import { useSendToEndpoint } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookTemplateDetail,
} from "@/lib/api/types";
import { findBlockingProblems } from "@/lib/webhooks/manual-send-request";
import {
  validateWebhookEndpointInput,
  type WebhookEndpointFieldErrors,
} from "@/lib/webhooks/validate-webhook-endpoint";

export const blankPreset = "blank";

function buildBlankFormValues(): WebhookEndpointFormValues {
  return {
    ...toFormValues(null, "native"),
    name: "Composer request",
    bodyMode: "raw",
    rawBody: '{\n  "event": "{{ event.type }}"\n}',
  };
}

/** The template's request as editable composer fields: method, headers and a raw body. */
function toPresetValues(
  templateDetail: WebhookTemplateDetail,
): Partial<WebhookEndpointFormValues> {
  return {
    method: templateDetail.method,
    headerRows: toNameValueRows(templateDetail.header_templates),
    bodyMode: "raw",
    rawContentType: templateDetail.content_type,
    rawBody: templateDetail.body_template,
  };
}

/** State, presets, preview and sending for the composer (WH-05.3, WH-05.5). */
export function useComposer(webhookEndpoints: WebhookEndpoint[]) {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = React.useState(buildBlankFormValues);
  const [targetEndpointId, setTargetEndpointId] = React.useState<string | null>(
    null,
  );
  const [presetId, setPresetId] = React.useState(blankPreset);
  const [fieldErrors, setFieldErrors] =
    React.useState<WebhookEndpointFieldErrors>({});
  const [sentDelivery, setSentDelivery] =
    React.useState<WebhookDelivery | null>(null);
  const sendVariables = useSendVariables();
  const sendToEndpoint = useSendToEndpoint();
  const targetEndpoint =
    webhookEndpoints.find(
      (webhookEndpoint) => webhookEndpoint.id === targetEndpointId,
    ) ?? webhookEndpoints[0];
  const composedInput = {
    ...toEndpointInput(formValues),
    url: formValues.url.trim() || (targetEndpoint?.url ?? ""),
  };
  const requestPreview = useEndpointRequestPreview(composedInput, {
    savedEndpointId: targetEndpoint?.id ?? null,
    variables: sendVariables.sendVariables,
  });
  const blockingProblems = findBlockingProblems(
    requestPreview.previewQuery.data?.problems ?? [],
    false,
  );

  const updateFormValues = (
    changedValues: Partial<WebhookEndpointFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const applyPreset = (nextPresetId: string) => {
    setPresetId(nextPresetId);
    if (nextPresetId === blankPreset) {
      setFormValues(buildBlankFormValues());
      return;
    }
    void queryClient
      .fetchQuery({
        queryKey: queryKeys.webhooks.template(nextPresetId),
        queryFn: ({ signal }) =>
          requestApi<WebhookTemplateDetail>(
            `/webhooks/templates/${nextPresetId}`,
            { abortSignal: signal },
          ),
      })
      .then((templateDetail) => {
        updateFormValues(toPresetValues(templateDetail));
      });
  };

  const sendNow = () => {
    const validationErrors = validateWebhookEndpointInput(composedInput);
    setFieldErrors(validationErrors);
    if (
      targetEndpoint === undefined ||
      Object.keys(validationErrors).length > 0
    ) {
      return;
    }
    sendToEndpoint.mutate(
      {
        endpointId: targetEndpoint.id,
        sendRequest: {
          ...requestPreview.renderRequest,
          request: composedInput,
          variables: sendVariables.sendVariables,
        },
      },
      {
        onSuccess: setSentDelivery,
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not send the request",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    targetEndpoint,
    setTargetEndpointId,
    presetId,
    applyPreset,
    sendVariables,
    requestPreview,
    blockingProblems,
    isSending: sendToEndpoint.isPending,
    sentDelivery,
    sendNow,
  };
}
