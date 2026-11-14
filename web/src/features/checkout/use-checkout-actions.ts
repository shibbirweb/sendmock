import * as React from "react";

import { ApiError } from "@/lib/api/api-client";
import { useCompleteCheckout } from "@/lib/api/hooks/use-payment-queries";
import type { CheckoutCompleteRequest } from "@/lib/api/types";

/** Runs a checkout page action and keeps the refusal to show inline. */
export function useCheckoutActions(sessionId: string) {
  const completeCheckout = useCompleteCheckout(sessionId);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  return {
    errorMessage,
    showError: setErrorMessage,
    isSubmitting: completeCheckout.isPending,
    submit: (checkoutRequest: CheckoutCompleteRequest) => {
      setErrorMessage(null);
      completeCheckout.mutate(checkoutRequest, {
        onError: (requestError) => {
          setErrorMessage(
            requestError instanceof ApiError
              ? requestError.message
              : "Something went wrong. Try again.",
          );
        },
      });
    },
  };
}

export type CheckoutActions = ReturnType<typeof useCheckoutActions>;
