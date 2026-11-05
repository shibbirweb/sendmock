import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionStatusBadge } from "@/features/payments/subscriptions/subscription-status-badge";
import type { PaymentSubscription } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { formatMinorAmount } from "@/lib/payments/format-money";

/** What a row's menu can do to a subscription. */
export type SubscriptionAction = "advance" | "cancel_at_period_end" | "cancel";

const actionLabels: Record<SubscriptionAction, string> = {
  advance: "Advance to renewal",
  cancel_at_period_end: "Cancel at period end",
  cancel: "Cancel now",
};

function listActions(subscription: PaymentSubscription): SubscriptionAction[] {
  if (subscription.status === "canceled") {
    return [];
  }
  return subscription.cancel_at_period_end
    ? ["advance", "cancel"]
    : ["advance", "cancel_at_period_end", "cancel"];
}

/** Every subscription with its plan, status, period and renewals (PY-07.4). */
export function PaymentSubscriptionsTable({
  subscriptions,
  onAction,
}: {
  subscriptions: PaymentSubscription[];
  onAction: (
    subscription: PaymentSubscription,
    subscriptionAction: SubscriptionAction,
  ) => void;
}) {
  return (
    <Table aria-label="Subscriptions">
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Period ends</TableHead>
          <TableHead className="hidden md:table-cell">Renewals</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((subscription) => (
          <TableRow key={subscription.id} data-testid="subscription-row">
            <TableCell className="text-sm">
              <span className="grid">
                <span>{subscription.customer_email}</span>
                <span className="text-xs text-muted-foreground">
                  {subscription.provider_name}, card {subscription.card_last4}
                </span>
              </span>
            </TableCell>
            <TableCell className="text-sm">
              {subscription.plan_name},{" "}
              {formatMinorAmount(
                subscription.amount_minor,
                subscription.currency,
              )}{" "}
              a {subscription.interval}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1">
                <SubscriptionStatusBadge
                  subscriptionStatus={subscription.status}
                />
                {subscription.cancel_at_period_end &&
                  subscription.status !== "canceled" && (
                    <span className="text-xs text-muted-foreground">
                      Ends at period end
                    </span>
                  )}
              </span>
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {formatDateTime(subscription.current_period_end)}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {subscription.renewal_count}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More for ${subscription.customer_email}`}
                    disabled={listActions(subscription).length === 0}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {listActions(subscription).map((subscriptionAction) => (
                    <DropdownMenuItem
                      key={subscriptionAction}
                      onSelect={() =>
                        onAction(subscription, subscriptionAction)
                      }
                    >
                      {actionLabels[subscriptionAction]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
