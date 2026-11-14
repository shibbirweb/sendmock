import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";

/** The bank's 3-D Secure step, as a test: approve or fail it (PY-03.1). */
export function ThreeDsChallenge({
  checkoutActions,
}: {
  checkoutActions: CheckoutActions;
}) {
  return (
    <section
      aria-label="3-D Secure"
      className="grid justify-items-center gap-4 rounded-lg border p-6 text-center"
    >
      <ShieldCheckIcon
        aria-hidden="true"
        className="size-8 text-checkout-accent"
      />
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Confirm it is you</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          This card asks for 3-D Secure. In test mode, choose what the bank
          answers.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          className="bg-checkout-accent text-checkout-accent-foreground hover:bg-checkout-accent/90"
          disabled={checkoutActions.isSubmitting}
          onClick={() => {
            checkoutActions.submit({ action: "three_ds_approve" });
          }}
        >
          Approve
        </Button>
        <Button
          variant="outline"
          disabled={checkoutActions.isSubmitting}
          onClick={() => {
            checkoutActions.submit({ action: "three_ds_fail" });
          }}
        >
          Fail authentication
        </Button>
      </div>
    </section>
  );
}
