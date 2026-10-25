import { ChevronDownIcon, FlaskConicalIcon, SendIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefundPaymentDialog } from "@/features/payments/detail/refund-payment-dialog";
import { ApiError } from "@/lib/api/api-client";
import {
  useResendPaymentNotification,
  useSimulatePayment,
} from "@/lib/api/hooks/use-payment-queries";
import type { PaymentDetail, PaymentSimulateRequest } from "@/lib/api/types";
import {
  declineReasons,
  listSimulateActions,
} from "@/lib/payments/payment-actions";

const actionLabels: Record<string, string> = {
  succeed: "Succeed",
  capture: "Capture",
  void: "Void authorization",
  dispute: "Open dispute",
  expire: "Expire checkout",
};

/** Only the actions the payment's status allows (PY-09.3). */
export function PaymentSimulateMenu({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  const simulatePayment = useSimulatePayment();
  const resendNotification = useResendPaymentNotification();
  const [isRefundOpen, setRefundOpen] = React.useState(false);
  const availableActions = listSimulateActions(paymentDetail);
  const reportError = (requestError: Error) => {
    toast.error(
      requestError instanceof ApiError
        ? requestError.message
        : "Could not simulate that",
    );
  };
  const runAction = (
    simulateRequest: PaymentSimulateRequest,
    onDone?: () => void,
  ) => {
    simulatePayment.mutate(
      { paymentId: paymentDetail.id, simulateRequest },
      {
        onSuccess: () => {
          onDone?.();
        },
        onError: reportError,
      },
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={availableActions.length === 0}>
            <FlaskConicalIcon />
            Simulate
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {availableActions.map((simulateAction) => {
            if (simulateAction === "decline") {
              return (
                <DropdownMenuSub key={simulateAction}>
                  <DropdownMenuSubTrigger>Decline</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {declineReasons.map((declineReason) => (
                      <DropdownMenuItem
                        key={declineReason.reason}
                        onSelect={() => {
                          runAction({
                            action: "decline",
                            decline_reason: declineReason.reason,
                          });
                        }}
                      >
                        {declineReason.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }
            if (simulateAction === "resolve_dispute") {
              return (
                <DropdownMenuSub key={simulateAction}>
                  <DropdownMenuSubTrigger>
                    Resolve dispute
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onSelect={() =>
                        runAction({
                          action: "resolve_dispute",
                          dispute_outcome: "won",
                        })
                      }
                    >
                      Won
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        runAction({
                          action: "resolve_dispute",
                          dispute_outcome: "lost",
                        })
                      }
                    >
                      Lost
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }
            if (simulateAction === "refund") {
              return (
                <DropdownMenuItem
                  key={simulateAction}
                  onSelect={() => setRefundOpen(true)}
                >
                  Refund...
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuItem
                key={simulateAction}
                onSelect={() => runAction({ action: simulateAction })}
              >
                {actionLabels[simulateAction] ?? simulateAction}
              </DropdownMenuItem>
            );
          })}
          {availableActions.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Changes fire the provider's notification
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        variant="outline"
        disabled={
          paymentDetail.notifications.length === 0 ||
          resendNotification.isPending
        }
        onClick={() => {
          resendNotification.mutate(paymentDetail.id, {
            onSuccess: () => {
              toast("Notification sent again");
            },
            onError: reportError,
          });
        }}
      >
        <SendIcon />
        Resend notification
      </Button>
      {isRefundOpen && (
        <RefundPaymentDialog
          paymentDetail={paymentDetail}
          isRefunding={simulatePayment.isPending}
          onRefund={(refundAmountMinor) => {
            runAction(
              { action: "refund", refund_amount_minor: refundAmountMinor },
              () => {
                setRefundOpen(false);
              },
            );
          }}
          onClose={() => setRefundOpen(false)}
        />
      )}
    </div>
  );
}
