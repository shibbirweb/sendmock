import * as React from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmailList } from "@/lib/api/hooks/use-email-queries";
import { useEndpointPreview } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import { useSmsList } from "@/lib/api/hooks/use-sms-queries";
import type {
  EndpointPreviewRequest,
  WebhookEndpointInput,
} from "@/lib/api/types";
import {
  type PreviewMessageOption,
  sampleOption,
  toRenderRequest,
} from "@/features/webhooks/templates/detail/use-template-preview";

const recentMessageLimit = 5;
const inputDebounceMs = 300;

/**
 * The endpoint request as it would be sent, following the form as you type
 * (WH-07.15), against the sample or a recent email or SMS.
 */
export function useEndpointRequestPreview(
  endpointInput: WebhookEndpointInput,
  savedEndpointId: string | null,
) {
  const [pickedOption, setPickedOption] = React.useState(sampleOption);
  const emailListQuery = useEmailList({ limit: recentMessageLimit });
  const smsListQuery = useSmsList({ limit: recentMessageLimit });
  // Debounce the text: a new input object every render would never settle.
  const debouncedInputText = useDebouncedValue(
    JSON.stringify(endpointInput),
    inputDebounceMs,
  );
  const previewRequest = React.useMemo<EndpointPreviewRequest>(
    () => ({
      endpoint: JSON.parse(debouncedInputText) as WebhookEndpointInput,
      ...(savedEndpointId === null ? {} : { endpoint_id: savedEndpointId }),
      ...toRenderRequest(pickedOption),
    }),
    [debouncedInputText, savedEndpointId, pickedOption],
  );
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
    previewQuery,
    /** The input the shown result was rendered from, to name problem sources. */
    renderedInput: previewRequest.endpoint,
  };
}
