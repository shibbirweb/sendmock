import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import {
  usePaymentGatewayPreview,
  useSavePaymentGateway,
} from "@/lib/api/hooks/use-payment-gateway-queries";
import type {
  PaymentEventType,
  PaymentGatewayDefinition,
  PaymentGatewayInput,
  PaymentRedirect,
} from "@/lib/api/types";
import { validatePaymentGateway } from "@/lib/payments/validate-payment-gateway";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function toGatewayInput(
  paymentGateway: PaymentGatewayDefinition,
): PaymentGatewayInput {
  return structuredClone({
    key: paymentGateway.key,
    name: paymentGateway.name,
    accent: paymentGateway.accent,
    is_enabled: paymentGateway.is_enabled,
    method_keys: paymentGateway.method_keys,
    credentials: paymentGateway.credentials,
    notification_endpoint_id: paymentGateway.notification_endpoint_id,
    redirect_method: paymentGateway.redirect_method,
    redirect_fields: paymentGateway.redirect_fields,
    notification_content_type: paymentGateway.notification_content_type,
    event_names: paymentGateway.event_names,
    notification_body: paymentGateway.notification_body,
    notification_headers: paymentGateway.notification_headers,
  });
}

/** What the preview renders against (PY-12.4). */
export type PreviewChoice = {
  paymentId: string | undefined;
  eventType: PaymentEventType;
  redirectOutcome: PaymentRedirect["outcome"];
};

/**
 * State, validation, the live preview and saving for the gateway sheet
 * (PY-12.2, PY-12.4). A save is refused while a template has errors.
 */
export function usePaymentGatewayForm(
  paymentGateway: PaymentGatewayDefinition,
  onSaved: () => void,
) {
  const saveGateway = useSavePaymentGateway();
  // What the sheet opened with: "unsaved changes" are measured against it.
  const [openedInput] = React.useState(() => toGatewayInput(paymentGateway));
  const [gatewayInput, setGatewayInput] = React.useState(openedInput);
  const [previewChoice, setPreviewChoice] = React.useState<PreviewChoice>({
    paymentId: undefined,
    eventType: "payment.succeeded",
    redirectOutcome: "success",
  });
  const [hasTriedSave, setTriedSave] = React.useState(false);
  const debouncedInput = useDebouncedValue(gatewayInput, 250);
  const previewQuery = usePaymentGatewayPreview({
    gateway: debouncedInput,
    payment_id: previewChoice.paymentId,
    event_type: previewChoice.eventType,
    redirect_outcome: previewChoice.redirectOutcome,
  });
  const fieldErrors = hasTriedSave ? validatePaymentGateway(gatewayInput) : {};
  const templateErrors = (previewQuery.data?.problems ?? []).filter(
    (problem) => problem.severity === "error",
  );

  return {
    gatewayInput,
    fieldErrors,
    previewChoice,
    previewQuery,
    templateErrors,
    isDirty: JSON.stringify(gatewayInput) !== JSON.stringify(openedInput),
    isSaving: saveGateway.isPending,
    updateInput: (changedFields: Partial<PaymentGatewayInput>) => {
      setGatewayInput((previousInput) => ({
        ...previousInput,
        ...changedFields,
      }));
    },
    choosePreview: (changedChoice: Partial<PreviewChoice>) => {
      setPreviewChoice((previousChoice) => ({
        ...previousChoice,
        ...changedChoice,
      }));
    },
    save: () => {
      setTriedSave(true);
      const validationErrors = validatePaymentGateway(gatewayInput);
      if (Object.keys(validationErrors).length > 0) {
        toast.error(Object.values(validationErrors)[0]);
        return;
      }
      saveGateway.mutate(gatewayInput, {
        onSuccess: () => {
          toast(`${gatewayInput.name} saved`);
          onSaved();
        },
        onError: (requestError) => {
          toast.error(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not save the gateway",
          );
        },
      });
    },
  };
}

export type PaymentGatewayForm = ReturnType<typeof usePaymentGatewayForm>;
