import * as React from "react";
import { toast } from "sonner";

import {
  useDeleteWebhookEndpoint,
  useSaveWebhookEndpoint,
  useTestWebhookEndpoint,
} from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/types";

/** Sheet, delete and Send test state for the endpoints screen. */
export function useWebhookEndpointActions() {
  const saveWebhookEndpoint = useSaveWebhookEndpoint();
  const deleteWebhookEndpoint = useDeleteWebhookEndpoint();
  const testWebhookEndpoint = useTestWebhookEndpoint();
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [editedEndpointId, setEditedEndpointId] = React.useState<string | null>(
    null,
  );
  const [newEndpointTemplateId, setNewEndpointTemplateId] =
    React.useState("native");
  const [deletedEndpoint, setDeletedEndpoint] =
    React.useState<WebhookEndpoint | null>(null);
  const [testedEndpointName, setTestedEndpointName] = React.useState<
    string | null
  >(null);
  const [testDelivery, setTestDelivery] =
    React.useState<WebhookDelivery | null>(null);

  const openSheet = (webhookEndpoint: WebhookEndpoint | null) => {
    setEditedEndpointId(webhookEndpoint?.id ?? null);
    setNewEndpointTemplateId("native");
    setSheetOpen(true);
  };

  /** "Use in new endpoint" from a template's detail (WH-08.5). */
  const openNewEndpointWithTemplate = (templateId: string) => {
    setEditedEndpointId(null);
    setNewEndpointTemplateId(templateId);
    setSheetOpen(true);
  };

  const sendTest = (webhookEndpoint: WebhookEndpoint) => {
    setTestedEndpointName(webhookEndpoint.name);
    setTestDelivery(null);
    testWebhookEndpoint.mutate(webhookEndpoint.id, {
      onSuccess: setTestDelivery,
      onError: () => {
        setTestedEndpointName(null);
        toast.error("Could not send the test");
      },
    });
  };

  const toggleEnabled = (
    webhookEndpoint: WebhookEndpoint,
    isEnabled: boolean,
  ) => {
    saveWebhookEndpoint.mutate(
      {
        endpointId: webhookEndpoint.id,
        endpointInput: { is_enabled: isEnabled },
      },
      {
        onSuccess: () => {
          toast(
            `${webhookEndpoint.name} ${isEnabled ? "enabled" : "disabled"}`,
          );
        },
        onError: () => {
          toast.error("Could not change the endpoint");
        },
      },
    );
  };

  const confirmDelete = () => {
    if (deletedEndpoint === null) {
      return;
    }

    deleteWebhookEndpoint.mutate(deletedEndpoint.id, {
      onSuccess: () => {
        toast("Endpoint deleted");
      },
    });
  };

  return {
    isSheetOpen,
    setSheetOpen,
    editedEndpointId,
    setEditedEndpointId,
    openSheet,
    openNewEndpointWithTemplate,
    newEndpointTemplateId,
    deletedEndpoint,
    setDeletedEndpoint,
    confirmDelete,
    toggleEnabled,
    sendTest,
    testedEndpointName,
    testDelivery,
    isTestSending: testWebhookEndpoint.isPending,
    closeTestDialog: () => {
      setTestedEndpointName(null);
    },
    createEndpoint: saveWebhookEndpoint.mutate,
  };
}
