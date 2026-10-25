import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutOrderSummary } from "@/features/checkout/checkout-order-summary";
import { CheckoutResult } from "@/features/checkout/checkout-result";
import { CheckoutTestControls } from "@/features/checkout/checkout-test-controls";
import { TestModeBanner } from "@/features/checkout/test-mode-banner";
import { ThreeDsChallenge } from "@/features/checkout/three-ds-challenge";
import { CheckoutMethodPanel } from "@/features/checkout/flows/checkout-method-panel";
import { useCheckoutActions } from "@/features/checkout/use-checkout-actions";
import { useCheckoutSession } from "@/lib/api/hooks/use-payment-queries";
import type { CheckoutSession } from "@/lib/api/types";
import { readReadableForeground } from "@/lib/payments/readable-foreground";

function CheckoutSteps({
  checkoutSession,
  sessionId,
}: {
  checkoutSession: CheckoutSession;
  sessionId: string;
}) {
  const checkoutActions = useCheckoutActions(sessionId);
  if (checkoutSession.state === "requires_three_ds") {
    return <ThreeDsChallenge checkoutActions={checkoutActions} />;
  }
  if (checkoutSession.state !== "open") {
    return <CheckoutResult checkoutSession={checkoutSession} />;
  }

  return (
    <div className="grid gap-4">
      <CheckoutMethodPanel
        checkoutSession={checkoutSession}
        checkoutActions={checkoutActions}
      />
      <CheckoutTestControls
        checkoutSession={checkoutSession}
        checkoutActions={checkoutActions}
      />
    </div>
  );
}

/**
 * The hosted test checkout at `/pay/{sessionId}`, standalone like a
 * gateway's page, always in test mode (PY-01.4, PY-03).
 */
export function CheckoutPage({ sessionId }: { sessionId: string }) {
  const sessionQuery = useCheckoutSession(sessionId);
  const checkoutSession = sessionQuery.data;

  return (
    <div
      data-checkout-theme={checkoutSession?.provider ?? "native"}
      className="min-h-svh bg-muted/30"
      // The gateway's configured colour, with readable text on it (PY-12.3).
      style={
        checkoutSession === undefined
          ? undefined
          : ({
              "--checkout-accent": checkoutSession.accent,
              "--checkout-accent-foreground": readReadableForeground(
                checkoutSession.accent,
              ),
            } as React.CSSProperties)
      }
    >
      <TestModeBanner />
      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-10">
        {sessionQuery.isPending && (
          <>
            <Skeleton className="h-48" />
            <Skeleton className="h-80" />
          </>
        )}
        {sessionQuery.isError && (
          <section className="grid gap-1 md:col-span-2">
            <h1 className="text-lg font-semibold">Checkout not found</h1>
            <p className="text-sm text-muted-foreground">
              This checkout link does not exist. Ask the shop for a new one.
            </p>
          </section>
        )}
        {checkoutSession !== undefined && (
          <>
            <div className="grid content-start gap-6">
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-checkout-accent"
                />
                {checkoutSession.provider_name} test checkout
              </p>
              <CheckoutOrderSummary checkoutSession={checkoutSession} />
            </div>
            <CheckoutSteps
              checkoutSession={checkoutSession}
              sessionId={sessionId}
            />
          </>
        )}
      </main>
    </div>
  );
}
