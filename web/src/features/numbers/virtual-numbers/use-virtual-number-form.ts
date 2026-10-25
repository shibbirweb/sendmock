import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSaveVirtualNumber } from "@/lib/api/hooks/use-numbers-queries";
import type {
  InboundWebhookMethod,
  NumberChannel,
  VirtualNumber,
  VirtualNumberInput,
} from "@/lib/api/types";
import {
  type VirtualNumberFieldErrors,
  validateVirtualNumberInput,
} from "@/lib/numbers/validate-virtual-number";

/** Form fields as typed; empty strings become null when saving. */
export type VirtualNumberFormValues = {
  number: string;
  label: string;
  channels: NumberChannel[];
  inboundUrl: string;
  inboundMethod: InboundWebhookMethod;
  inboundFallbackUrl: string;
  inboundTemplateId: string;
  statusCallbackUrl: string;
  messagingServiceSid: string;
};

/** Select value for "no Messaging Service" (Select items cannot be empty). */
export const noMessagingService = "none";
const defaultInboundTemplateId = "twilio.inbound_sms";

function toFormValues(
  virtualNumber: VirtualNumber | null,
): VirtualNumberFormValues {
  return {
    number: virtualNumber?.number ?? "",
    label: virtualNumber?.label ?? "",
    channels: virtualNumber?.channels ?? ["sms"],
    inboundUrl: virtualNumber?.inbound_url ?? "",
    inboundMethod: virtualNumber?.inbound_method ?? "POST",
    inboundFallbackUrl: virtualNumber?.inbound_fallback_url ?? "",
    inboundTemplateId:
      virtualNumber?.inbound_template_id ?? defaultInboundTemplateId,
    statusCallbackUrl: virtualNumber?.status_callback_url ?? "",
    messagingServiceSid:
      virtualNumber?.messaging_service_sid ?? noMessagingService,
  };
}

function toNullableText(fieldText: string): string | null {
  const trimmedText = fieldText.trim();

  return trimmedText === "" ? null : trimmedText;
}

function toNumberInput(
  formValues: VirtualNumberFormValues,
): VirtualNumberInput {
  return {
    number: formValues.number.trim(),
    label: formValues.label,
    channels: formValues.channels,
    inbound_url: toNullableText(formValues.inboundUrl),
    inbound_method: formValues.inboundMethod,
    inbound_fallback_url: toNullableText(formValues.inboundFallbackUrl),
    inbound_template_id: formValues.inboundTemplateId,
    status_callback_url: toNullableText(formValues.statusCallbackUrl),
    messaging_service_sid:
      formValues.messagingServiceSid === noMessagingService
        ? null
        : formValues.messagingServiceSid,
  };
}

/** State, validation (SM-12.3) and saving for the number side sheet. */
export function useVirtualNumberForm({
  editedNumber,
  registeredNumbers,
  onSaved,
}: {
  editedNumber: VirtualNumber | null;
  /** Every registered number except the one being edited. */
  registeredNumbers: string[];
  onSaved: () => void;
}) {
  const saveVirtualNumber = useSaveVirtualNumber();
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedNumber),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<VirtualNumberFieldErrors>({});

  const updateFormValues = (
    changedValues: Partial<VirtualNumberFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const toggleChannel = (numberChannel: NumberChannel, isChecked: boolean) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      channels: isChecked
        ? [...previousValues.channels, numberChannel]
        : previousValues.channels.filter(
            (selectedChannel) => selectedChannel !== numberChannel,
          ),
    }));
  };

  const saveNumber = () => {
    const numberInput = toNumberInput(formValues);
    const validationErrors = validateVirtualNumberInput(
      numberInput,
      registeredNumbers,
    );
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    saveVirtualNumber.mutate(
      { numberId: editedNumber?.id ?? null, numberInput },
      {
        onSuccess: () => {
          toast(editedNumber === null ? "Number added" : "Number saved");
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the number",
          );
        },
      },
    );
  };

  return {
    formValues,
    updateFormValues,
    toggleChannel,
    fieldErrors,
    isSaving: saveVirtualNumber.isPending,
    saveNumber,
  };
}
