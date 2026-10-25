import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import {
  useCancelDeliveryRetries,
  useReplayDelivery,
  useSaveDelivery,
} from "@/lib/api/hooks/use-webhook-delivery-queries";
import type {
  DeliveryReplayRequest,
  WebhookDeliveryDetail,
} from "@/lib/api/types";
import { buildCurlCommand } from "@/lib/webhooks/build-curl-command";

export type PendingDeliveryDialog = "edit-replay" | "cancel" | "save" | null;

/** Copy, replay, cancel and save for one delivery; a replay opens the new one. */
export function useDeliveryActions(deliveryDetail: WebhookDeliveryDetail) {
  const navigate = useNavigate({ from: "/webhooks/deliveries" });
  const replayDelivery = useReplayDelivery();
  const cancelDeliveryRetries = useCancelDeliveryRetries();
  const saveDelivery = useSaveDelivery();
  const [pendingDialog, setPendingDialog] =
    React.useState<PendingDeliveryDialog>(null);

  const replay = (replayRequest: DeliveryReplayRequest) => {
    replayDelivery.mutate(
      { deliveryId: deliveryDetail.id, replayRequest },
      {
        onSuccess: (replayedDelivery) => {
          setPendingDialog(null);
          toast("Replayed");
          void navigate({ search: { delivery: replayedDelivery.id } });
        },
        onError: () => {
          toast.error("Could not replay the delivery");
        },
      },
    );
  };

  return {
    pendingDialog,
    setPendingDialog,
    isReplaying: replayDelivery.isPending,
    isSaving: saveDelivery.isPending,
    replay,
    copyAsCurl: () => {
      if (deliveryDetail.request === null) {
        return;
      }

      void navigator.clipboard
        .writeText(buildCurlCommand(deliveryDetail.request))
        .then(() => {
          toast("Copied as cURL");
        });
    },
    cancelRetries: () => {
      cancelDeliveryRetries.mutate(deliveryDetail.id, {
        onSuccess: () => {
          toast("Retries cancelled");
        },
        onError: () => {
          toast.error("Could not cancel the retries");
        },
      });
    },
    save: (savedName: string) => {
      saveDelivery.mutate(
        { deliveryId: deliveryDetail.id, savedName },
        {
          onSuccess: () => {
            setPendingDialog(null);
            toast("Saved", { description: savedName });
          },
          onError: () => {
            toast.error("Could not save the delivery");
          },
        },
      );
    },
  };
}
