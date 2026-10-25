import * as React from "react";
import { toast } from "sonner";

import { useEndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/use-endpoint-request-preview";
import { useSendVariables } from "@/features/webhooks/send/use-send-variables";
import { ApiError } from "@/lib/api/api-client";
import { useSendToEndpoint } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import type {
  ManualSendRequest,
  TemplateRenderRequest,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/api/types";
import {
  buildSendEndpointInput,
  findBlockingProblems,
  pickEndpointInput,
  suggestSendEndpoint,
} from "@/lib/webhooks/manual-send-request";

/** State, preview and sending for Send to webhook (WH-05.1, WH-05.5, WH-05.6). */
export function useSendToWebhook(
  webhookEndpoints: [WebhookEndpoint, ...WebhookEndpoint[]],
  renderRequest: TemplateRenderRequest,
) {
  const [chosenEndpointId, setChosenEndpointId] = React.useState<string | null>(
    null,
  );
  const webhookTemplates = useWebhookTemplates().data ?? [];
  const chosenEndpoint =
    webhookEndpoints.find(
      (webhookEndpoint) => webhookEndpoint.id === chosenEndpointId,
    ) ?? suggestSendEndpoint(webhookEndpoints, webhookTemplates, renderRequest);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [editedBody, setEditedBody] = React.useState<string | null>(null);
  const [sentDelivery, setSentDelivery] =
    React.useState<WebhookDelivery | null>(null);
  const sendVariables = useSendVariables();
  const sendToEndpoint = useSendToEndpoint();
  const formatRequest = templateId === null ? {} : { template_id: templateId };
  const requestPreview = useEndpointRequestPreview(
    buildSendEndpointInput(pickEndpointInput(chosenEndpoint), formatRequest),
    {
      savedEndpointId: chosenEndpoint.id,
      variables: sendVariables.sendVariables,
      fixedRenderRequest: renderRequest,
    },
  );
  const blockingProblems = findBlockingProblems(
    requestPreview.previewQuery.data?.problems ?? [],
    editedBody !== null,
  );

  const sendNow = () => {
    const sendRequest: ManualSendRequest = {
      ...renderRequest,
      ...formatRequest,
      variables: sendVariables.sendVariables,
      ...(editedBody === null ? {} : { body: editedBody }),
    };
    sendToEndpoint.mutate(
      { endpointId: chosenEndpoint.id, sendRequest },
      {
        onSuccess: setSentDelivery,
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not send to the endpoint",
          );
        },
      },
    );
  };

  return {
    chosenEndpoint,
    chooseEndpoint: setChosenEndpointId,
    templateId,
    setTemplateId,
    editedBody,
    setEditedBody,
    sendVariables,
    requestPreview,
    blockingProblems,
    isSending: sendToEndpoint.isPending,
    sentDelivery,
    sendNow,
  };
}
