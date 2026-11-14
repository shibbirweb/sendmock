import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  forcedStateActions,
  verificationStatusLabels,
} from "@/features/verify/verify-labels";
import { useForceVerificationState } from "@/lib/api/hooks/use-verify-queries";

/** Approve, Cancel, Expire or Max attempts for a pending verification (VF-04.1). */
export function VerificationForceButtons({
  verificationSid,
}: {
  verificationSid: string;
}) {
  const forceVerificationState = useForceVerificationState();

  return (
    <section aria-labelledby="force-state-title" className="grid gap-2">
      <h3 id="force-state-title" className="text-sm font-medium">
        Force a state
      </h3>
      <div className="flex flex-wrap gap-2">
        {forcedStateActions.map(({ forcedState, label }) => (
          <Button
            key={forcedState}
            variant={forcedState === "approved" ? "default" : "outline"}
            size="sm"
            disabled={forceVerificationState.isPending}
            onClick={() => {
              forceVerificationState.mutate(
                { verificationSid, forcedState },
                {
                  onSuccess: (forcedVerification) => {
                    toast(
                      `Verification ${verificationStatusLabels[forcedVerification.status].toLowerCase()}`,
                    );
                  },
                  onError: () => {
                    toast.error("Could not change the verification");
                  },
                },
              );
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Your app sees the new state on its next check or fetch.
      </p>
    </section>
  );
}
