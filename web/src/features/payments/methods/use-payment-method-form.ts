import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import { useSavePaymentMethod } from "@/lib/api/hooks/use-payment-method-queries";
import type {
  PaymentFlowDefinition,
  PaymentMethodDefinition,
  PaymentMethodInput,
} from "@/lib/api/types";
import {
  type PaymentMethodFieldErrors,
  validatePaymentMethod,
} from "@/lib/payments/validate-payment-method";

export function toMethodInput(
  paymentMethod: PaymentMethodDefinition,
): PaymentMethodInput {
  return {
    key: paymentMethod.key,
    name: paymentMethod.name,
    flow: paymentMethod.flow,
    accent: paymentMethod.accent,
    is_enabled: paymentMethod.is_enabled,
    test_cards: paymentMethod.test_cards,
    test_numbers: paymentMethod.test_numbers,
    otp: paymentMethod.otp,
    pin: paymentMethod.pin,
    default_outcome: paymentMethod.default_outcome,
    test_account: paymentMethod.test_account,
  };
}

/** State, validation and saving for the method sheet; its flow decides which test values are checked (PY-12.1, PY-12.6). */
export function usePaymentMethodForm(
  paymentMethod: PaymentMethodDefinition,
  paymentFlow: PaymentFlowDefinition | undefined,
  onSaved: () => void,
) {
  const savePaymentMethod = useSavePaymentMethod();
  const [methodInput, setMethodInput] = React.useState(() =>
    toMethodInput(paymentMethod),
  );
  const [fieldErrors, setFieldErrors] =
    React.useState<PaymentMethodFieldErrors>({});

  return {
    methodInput,
    fieldErrors,
    isSaving: savePaymentMethod.isPending,
    updateInput: (changedFields: Partial<PaymentMethodInput>) => {
      setMethodInput((previousInput) => ({
        ...previousInput,
        ...changedFields,
      }));
    },
    save: () => {
      const validationErrors = validatePaymentMethod(
        methodInput,
        [],
        false,
        paymentFlow?.steps,
      );
      setFieldErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        return;
      }
      savePaymentMethod.mutate(
        { methodInput, isNew: false },
        {
          onSuccess: () => {
            toast(`${methodInput.name} saved`);
            onSaved();
          },
          onError: (requestError) => {
            toast.error(
              requestError instanceof ApiError
                ? requestError.message
                : "Could not save the method",
            );
          },
        },
      );
    },
  };
}
