import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type {
  CheckoutCompleteRequest,
  CheckoutSession,
  DeclineReason,
  PaymentMethodDefinition,
} from "@/lib/api/types";
import { declineReasons } from "@/lib/payments/payment-actions";

/** A successful payment with the gateway's first method and its first succeeding test value. */
function buildQuickPayRequest(
  paymentMethod: PaymentMethodDefinition | undefined,
): CheckoutCompleteRequest {
  if (paymentMethod === undefined) {
    return { action: "pay" };
  }
  if (paymentMethod.flow === "card") {
    const succeedingCard = paymentMethod.test_cards.find(
      (testCard) => testCard.outcome === "succeed",
    );
    return {
      action: "pay",
      method_key: paymentMethod.key,
      card: {
        number: succeedingCard?.number ?? "",
        exp_month: 12,
        exp_year: 2034,
        cvc: "123",
        holder_name: "Test Customer",
      },
    };
  }
  if (paymentMethod.flow === "wallet") {
    const succeedingWallet = paymentMethod.test_wallets.find(
      (testWallet) => testWallet.outcome === "succeed",
    );
    return {
      action: "pay",
      method_key: paymentMethod.key,
      wallet: {
        number: succeedingWallet?.number ?? "",
        otp: paymentMethod.otp,
        pin: paymentMethod.pin,
      },
    };
  }

  return { action: "pay", method_key: paymentMethod.key };
}

/** One click to each outcome, beside the provider's own form (PY-03.1). */
export function CheckoutTestControls({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  const reasonPickerId = React.useId();
  const [declineReason, setDeclineReason] =
    React.useState<DeclineReason>("insufficient_funds");
  const isBusy = checkoutActions.isSubmitting;
  // 3-D Secure belongs to cards; wallets confirm with their own PIN or login.
  const isCardProvider = checkoutSession.methods.some(
    (paymentMethod) => paymentMethod.flow === "card",
  );

  return (
    <aside
      aria-label="Test controls"
      className="grid content-start gap-3 rounded-lg border border-dashed p-4"
    >
      <div className="grid gap-0.5">
        <h2 className="text-sm font-semibold">Test controls</h2>
        <p className="text-xs text-muted-foreground">
          Skip the form and pick the outcome.
        </p>
      </div>
      <Button
        disabled={isBusy}
        onClick={() => {
          checkoutActions.submit(
            buildQuickPayRequest(checkoutSession.methods[0]),
          );
        }}
      >
        Pay successfully
      </Button>
      <div className="grid gap-1.5">
        <Label htmlFor={reasonPickerId} className="text-xs">
          Decline reason
        </Label>
        <div className="flex gap-2">
          <Select
            value={declineReason}
            onValueChange={(selectedReason) => {
              setDeclineReason(selectedReason as DeclineReason);
            }}
          >
            <SelectTrigger id={reasonPickerId} className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {declineReasons.map((reasonOption) => (
                <SelectItem
                  key={reasonOption.reason}
                  value={reasonOption.reason}
                >
                  {reasonOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              checkoutActions.submit({
                action: "decline",
                decline_reason: declineReason,
              });
            }}
          >
            Decline
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isCardProvider && (
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              checkoutActions.submit({ action: "require_three_ds" });
            }}
          >
            Require 3-D Secure
          </Button>
        )}
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() => {
            checkoutActions.submit({ action: "delay" });
          }}
        >
          Delay
        </Button>
      </div>
      <Button
        variant="ghost"
        disabled={isBusy}
        onClick={() => {
          checkoutActions.submit({ action: "cancel" });
        }}
      >
        Cancel payment
      </Button>
    </aside>
  );
}
