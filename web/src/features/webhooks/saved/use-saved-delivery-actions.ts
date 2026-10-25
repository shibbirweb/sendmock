import * as React from "react";
import { toast } from "sonner";

import type { SavedDeliveryAction } from "@/features/webhooks/saved/saved-delivery-item";
import {
  useDeleteSavedDelivery,
  useRenameSavedDelivery,
  useSaveAsTemplate,
} from "@/lib/api/hooks/use-saved-delivery-queries";
import type { SavedDelivery } from "@/lib/api/types";

type OpenSavedAction = {
  savedAction: SavedDeliveryAction;
  savedDelivery: SavedDelivery;
} | null;

/** Which dialog is open for which saved delivery, and the calls behind them. */
export function useSavedDeliveryActions() {
  const renameSavedDelivery = useRenameSavedDelivery();
  const deleteSavedDelivery = useDeleteSavedDelivery();
  const saveAsTemplate = useSaveAsTemplate();
  const [openAction, setOpenAction] = React.useState<OpenSavedAction>(null);
  const closeAction = () => {
    setOpenAction(null);
  };

  return {
    openAction,
    openSavedAction: (
      savedDelivery: SavedDelivery,
      savedAction: SavedDeliveryAction,
    ) => {
      setOpenAction({ savedAction, savedDelivery });
    },
    closeAction,
    isRenaming: renameSavedDelivery.isPending,
    isSavingTemplate: saveAsTemplate.isPending,
    rename: (savedDelivery: SavedDelivery, savedName: string) => {
      renameSavedDelivery.mutate(
        { savedId: savedDelivery.id, savedName },
        {
          onSuccess: () => {
            closeAction();
            toast("Renamed");
          },
          onError: () => {
            toast.error("Could not rename the saved delivery");
          },
        },
      );
    },
    saveTemplate: (savedDelivery: SavedDelivery, templateName: string) => {
      saveAsTemplate.mutate(
        { savedId: savedDelivery.id, templateName },
        {
          onSuccess: (customTemplate) => {
            closeAction();
            toast("Template saved", {
              description: `${customTemplate.name} is on the Templates screen.`,
            });
          },
          onError: () => {
            toast.error("Could not save the template");
          },
        },
      );
    },
    remove: (savedDelivery: SavedDelivery) => {
      deleteSavedDelivery.mutate(savedDelivery.id, {
        onSuccess: () => {
          toast("Saved delivery deleted");
        },
      });
    },
  };
}
