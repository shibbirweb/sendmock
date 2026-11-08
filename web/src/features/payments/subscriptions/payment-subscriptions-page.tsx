import { PlusIcon, RepeatIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NewSubscriptionDialog } from "@/features/payments/subscriptions/new-subscription-dialog";
import {
  PaymentSubscriptionsTable,
  type SubscriptionAction,
} from "@/features/payments/subscriptions/payment-subscriptions-table";
import { usePageTitle } from "@/hooks/use-page-title";
import { ApiError } from "@/lib/api/api-client";
import {
  useAdvancePaymentSubscription,
  useCancelPaymentSubscription,
  usePaymentSubscriptions,
} from "@/lib/api/hooks/use-payment-subscription-queries";
import type { PaymentSubscription } from "@/lib/api/types";

/** Runs a row's action; each refreshes the list and the payments it charged. */
function useSubscriptionActions() {
  const advanceSubscription = useAdvancePaymentSubscription();
  const cancelSubscription = useCancelPaymentSubscription();
  const reportError = (actionError: Error) => {
    toast.error(
      actionError instanceof ApiError
        ? actionError.message
        : "Could not change the subscription",
    );
  };

  return (
    subscription: PaymentSubscription,
    subscriptionAction: SubscriptionAction,
  ) => {
    if (subscriptionAction === "advance") {
      advanceSubscription.mutate(subscription.id, { onError: reportError });
      return;
    }
    cancelSubscription.mutate(
      {
        subscriptionId: subscription.id,
        cancelRequest: {
          at_period_end: subscriptionAction === "cancel_at_period_end",
        },
      },
      { onError: reportError },
    );
  };
}

/** Payments > Subscriptions: renewals on each subscription's own clock (PY-07.4). */
export function PaymentSubscriptionsPage() {
  usePageTitle("Subscriptions", "Payments");
  const subscriptionsQuery = usePaymentSubscriptions();
  const runAction = useSubscriptionActions();
  const [isNewOpen, setNewOpen] = React.useState(false);
  const subscriptions = subscriptionsQuery.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Subscriptions</h2>
            <p className="text-sm text-muted-foreground">
              Each subscription keeps its own clock: advance it to charge the
              next renewal through its gateway, or cancel it.
            </p>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <PlusIcon />
            New subscription
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {subscriptionsQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : subscriptionsQuery.isError ? (
            <QueryErrorState
              message="Could not load the subscriptions."
              onRetry={() => void subscriptionsQuery.refetch()}
            />
          ) : subscriptions.length === 0 ? (
            <NoDataState
              icon={RepeatIcon}
              title="No subscriptions yet"
              description="Start one with New subscription, or POST /api/v1/payments/subscriptions, to test renewals, failed payments and cancellations."
            />
          ) : (
            <PaymentSubscriptionsTable
              subscriptions={subscriptions}
              onAction={runAction}
            />
          )}
        </div>
      </div>
      {isNewOpen && <NewSubscriptionDialog onClose={() => setNewOpen(false)} />}
    </div>
  );
}
