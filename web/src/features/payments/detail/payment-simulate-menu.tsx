import { ChevronDownIcon, FlaskConicalIcon, SendIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentSimulateItems } from "@/features/payments/detail/payment-simulate-items";
import { WebhookTargets } from "@/features/webhooks/targets/webhook-targets";
import { AnswerDisputeDialog } from "@/features/payments/detail/answer-dispute-dialog";
import { RefundPaymentDialog } from "@/features/payments/detail/refund-payment-dialog";
import { ApiError } from "@/lib/api/api-client";
import {
  useResendPaymentNotification,
  useSimulatePayment,
} from "@/lib/api/hooks/use-payment-queries";
import type {
  PaymentDetail,
  PaymentSimulateRequest,
  WebhookChoice,
} from "@/lib/api/types";
import { listSimulateActions } from "@/lib/payments/payment-actions";

/** Only the actions the payment's status allows (PY-09.3). */
export function PaymentSimulateMenu({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  const simulatePayment = useSimulatePayment();
  const resendNotification = useResendPaymentNotification();
  // The dialogs stay mounted and close through `open`: unmounting an open dialog could
  // leave the page locked. A new key each opening starts them fresh.
  const [isRefundOpen, setRefundOpen] = React.useState(false);
  const [isAnswerOpen, setAnswerOpen] = React.useState(false);
  const [dialogOpeningCount, setDialogOpeningCount] = React.useState(0);
  // The webhooks chosen for the Refund or Answer dispute the dialog will send.
  const pendingChoiceRef = React.useRef<WebhookChoice>({});
  const openDialog = (setDialogOpen: (isOpen: boolean) => void) => {
    setDialogOpeningCount((openingCount) => openingCount + 1);
    setDialogOpen(true);
  };
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
      {/* Not modal: a live update re-renders the drawer as the menu closes, and a modal
          menu could leave the page locked for the next one. */}
      <WebhookTargets.MenuScope>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={availableActions.length === 0}>
              <FlaskConicalIcon />
              Simulate
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <PaymentSimulateItems
              paymentDetail={paymentDetail}
              availableActions={availableActions}
              handlers={{
                onRun: (simulateRequest, webhookChoice) => {
                  runAction({ ...simulateRequest, ...webhookChoice });
                },
                onOpenDialog: (simulateAction, webhookChoice) => {
                  pendingChoiceRef.current = webhookChoice;
                  openDialog(
                    simulateAction === "refund" ? setRefundOpen : setAnswerOpen,
                  );
                },
              }}
            />
            {availableActions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Changes fire the provider's notification
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </WebhookTargets.MenuScope>
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
      {dialogOpeningCount > 0 && (
        <RefundPaymentDialog
          key={`refund-${dialogOpeningCount}`}
          isOpen={isRefundOpen}
          paymentDetail={paymentDetail}
          isRefunding={simulatePayment.isPending}
          onRefund={(refundAmountMinor) => {
            runAction(
              {
                action: "refund",
                refund_amount_minor: refundAmountMinor,
                ...pendingChoiceRef.current,
              },
              () => {
                setRefundOpen(false);
              },
            );
          }}
          onClose={() => setRefundOpen(false)}
        />
      )}
      {dialogOpeningCount > 0 && (
        <AnswerDisputeDialog
          key={`answer-${dialogOpeningCount}`}
          isOpen={isAnswerOpen}
          isAnswering={simulatePayment.isPending}
          onAnswer={(disputeEvidence) => {
            runAction(
              {
                action: "answer_dispute",
                dispute_evidence: disputeEvidence,
                ...pendingChoiceRef.current,
              },
              () => {
                setAnswerOpen(false);
              },
            );
          }}
          onClose={() => setAnswerOpen(false)}
        />
      )}
    </div>
  );
}
