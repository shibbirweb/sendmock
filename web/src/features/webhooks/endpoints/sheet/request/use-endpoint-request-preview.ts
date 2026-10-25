import * as React from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmailList } from "@/lib/api/hooks/use-email-queries";
import { useEndpointPreview } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import { useSmsList } from "@/lib/api/hooks/use-sms-queries";
import type {
  EndpointPreviewRequest,
  TemplateRenderRequest,
  WebhookEndpointInput,
} from "@/lib/api/types";
import {
  type PreviewMessageOption,
  sampleOption,
  toRenderRequest,
} from "@/features/webhooks/templates/detail/use-template-preview";

const recentMessageLimit = 5;
const inputDebounceMs = 300;

type RequestPreviewOptions = {
  /** A saved endpoint's own variables are used too. */
  savedEndpointId?: string | null;
  /** Send-time values (WH-05.5). */
  variables?: Record<string, string>;
  /** Render against this message only; the picker is hidden. */
  fixedRenderRequest?: TemplateRenderRequest;
};

/**
 * The endpoint request as it would be sent, following the form as you type
 * (WH-07.15), against the sample or a recent email or SMS.
 */
export function useEndpointRequestPreview(
  endpointInput: WebhookEndpointInput,
  {
    savedEndpointId = null,
    variables = {},
    fixedRenderRequest,
  }: RequestPreviewOptions = {},
) {
  const [pickedOption, setPickedOption] = React.useState(sampleOption);
  const emailListQuery = useEmailList({ limit: recentMessageLimit });
  const smsListQuery = useSmsList({ limit: recentMessageLimit });
  // Debounce the text: new objects every render would never settle.
  const debouncedInputText = useDebouncedValue(
    JSON.stringify({ endpointInput, variables }),
    inputDebounceMs,
  );
  const renderRequest = fixedRenderRequest ?? toRenderRequest(pickedOption);
  const renderRequestText = JSON.stringify(renderRequest);
  const previewRequest = React.useMemo<EndpointPreviewRequest>(() => {
    const debouncedInput = JSON.parse(debouncedInputText) as {
      endpointInput: WebhookEndpointInput;
      variables: Record<string, string>;
    };

    return {
      endpoint: debouncedInput.endpointInput,
      ...(savedEndpointId === null ? {} : { endpoint_id: savedEndpointId }),
      ...(JSON.parse(renderRequestText) as TemplateRenderRequest),
      ...(Object.keys(debouncedInput.variables).length === 0
        ? {}
        : { variables: debouncedInput.variables }),
    };
  }, [debouncedInputText, savedEndpointId, renderRequestText]);
  const previewQuery = useEndpointPreview(previewRequest);
  const messageOptions: PreviewMessageOption[] = [
    ...(emailListQuery.data?.items ?? []).map((emailSummary) => ({
      optionValue: `email:${emailSummary.id}`,
      label: `Email: ${emailSummary.subject || "(no subject)"}`,
    })),
    ...(smsListQuery.data?.items ?? []).map((smsMessage) => ({
      optionValue: `sms:${smsMessage.id}`,
      label: `SMS: ${smsMessage.body.slice(0, 60)}`,
    })),
  ];

  return {
    pickedOption,
    setPickedOption,
    messageOptions,
    isMessageFixed: fixedRenderRequest !== undefined,
    /** The message a send renders against, the same as the preview. */
    renderRequest,
    previewQuery,
    /** The input the shown result was rendered from, to name problem sources. */
    renderedInput: previewRequest.endpoint,
  };
}
