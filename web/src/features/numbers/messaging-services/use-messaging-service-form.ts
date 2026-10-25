import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSaveMessagingService } from "@/lib/api/hooks/use-numbers-queries";
import type {
  MessagingService,
  MessagingServiceInboundMode,
  MessagingServiceInput,
} from "@/lib/api/types";
import {
  type MessagingServiceFieldErrors,
  validateMessagingServiceInput,
} from "@/lib/numbers/validate-messaging-service";

export type MessagingServiceFormValues = {
  friendlyName: string;
  numberIds: string[];
  inboundMode: MessagingServiceInboundMode;
  inboundUrl: string;
  inboundFallbackUrl: string;
};

function toFormValues(
  messagingService: MessagingService | null,
): MessagingServiceFormValues {
  return {
    friendlyName: messagingService?.friendly_name ?? "",
    numberIds: messagingService?.number_ids ?? [],
    inboundMode: messagingService?.inbound_mode ?? "defer_to_sender",
    inboundUrl: messagingService?.inbound_url ?? "",
    inboundFallbackUrl: messagingService?.inbound_fallback_url ?? "",
  };
}

function toNullableText(fieldText: string): string | null {
  const trimmedText = fieldText.trim();

  return trimmedText === "" ? null : trimmedText;
}

function toServiceInput(
  formValues: MessagingServiceFormValues,
): MessagingServiceInput {
  const isWebhookMode = formValues.inboundMode === "webhook";

  return {
    friendly_name: formValues.friendlyName,
    number_ids: formValues.numberIds,
    inbound_mode: formValues.inboundMode,
    // URLs only matter in webhook mode; other modes clear them.
    inbound_url: isWebhookMode ? toNullableText(formValues.inboundUrl) : null,
    inbound_fallback_url: isWebhookMode
      ? toNullableText(formValues.inboundFallbackUrl)
      : null,
  };
}

/** State, validation and saving for the Messaging Service sheet (SM-03.4). */
export function useMessagingServiceForm({
  editedService,
  onSaved,
}: {
  editedService: MessagingService | null;
  onSaved: () => void;
}) {
  const saveMessagingService = useSaveMessagingService();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedService),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<MessagingServiceFieldErrors>({});

  const updateFormValues = (
    changedValues: Partial<MessagingServiceFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const togglePoolNumber = (numberId: string, isChecked: boolean) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      numberIds: isChecked
        ? [...previousValues.numberIds, numberId]
        : previousValues.numberIds.filter(
            (selectedNumberId) => selectedNumberId !== numberId,
          ),
    }));
  };

  const saveService = () => {
    const serviceInput = toServiceInput(formValues);
    const validationErrors = validateMessagingServiceInput(serviceInput);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveMessagingService.mutate(
      { serviceSid: editedService?.sid ?? null, serviceInput },
      {
        onSuccess: () => {
          toast(editedService === null ? "Service created" : "Service saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the service",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    togglePoolNumber,
    fieldErrors,
    isSaving: saveMessagingService.isPending,
    saveService,
  };
}
