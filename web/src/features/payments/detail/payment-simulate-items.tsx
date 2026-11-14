import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { WebhookTargets } from "@/features/webhooks/targets/webhook-targets";
import type {
  AppEventType,
  PaymentDetail,
  PaymentSimulateAction,
  PaymentSimulateRequest,
  WebhookChoice,
} from "@/lib/api/types";
import { declineReasons } from "@/lib/payments/payment-actions";

const actionLabels: Record<PaymentSimulateAction, string> = {
  succeed: "Succeed",
  capture: "Capture",
  void: "Void authorization",
  dispute: "Open dispute",
  expire: "Expire checkout",
  decline: "Decline",
  refund: "Refund...",
  answer_dispute: "Answer dispute...",
  resolve_dispute: "Resolve dispute",
};

/** The event each action fires, whose webhooks the item names. */
const actionEventTypes: Record<PaymentSimulateAction, AppEventType> = {
  succeed: "payment.succeeded",
  capture: "payment.succeeded",
  void: "payment.canceled",
  dispute: "payment.dispute_opened",
  expire: "checkout.expired",
  decline: "payment.failed",
  refund: "payment.refunded",
  answer_dispute: "payment.dispute_updated",
  resolve_dispute: "payment.dispute_closed",
};

export type PaymentSimulateHandlers = {
  onRun: (
    simulateRequest: PaymentSimulateRequest,
    webhookChoice: WebhookChoice,
  ) => void;
  /** Refund and Answer dispute ask for more first; the choice waits for them. */
  onOpenDialog: (
    simulateAction: "refund" | "answer_dispute",
    webhookChoice: WebhookChoice,
  ) => void;
};

/**
 * Payments' Simulate actions, each naming the webhooks its event will trigger
 * with Choose beside it (WH-13.2); only the actions the status allows.
 */
export function PaymentSimulateItems({
  paymentDetail,
  availableActions,
  handlers,
}: {
  paymentDetail: PaymentDetail;
  availableActions: PaymentSimulateAction[];
  handlers: PaymentSimulateHandlers;
}) {
  const buildTargetEvent = (simulateAction: PaymentSimulateAction) => ({
    eventType: actionEventTypes[simulateAction],
    subjectId: paymentDetail.id,
  });

  return availableActions.map((simulateAction) => {
    if (simulateAction === "decline" || simulateAction === "resolve_dispute") {
      const choices =
        simulateAction === "decline"
          ? declineReasons.map((declineReason) => ({
              label: declineReason.label,
              simulateRequest: {
                action: "decline" as const,
                decline_reason: declineReason.reason,
              },
            }))
          : (["won", "lost"] as const).map((disputeOutcome) => ({
              label: disputeOutcome === "won" ? "Won" : "Lost",
              simulateRequest: {
                action: "resolve_dispute" as const,
                dispute_outcome: disputeOutcome,
              },
            }));

      return (
        <DropdownMenuSub key={simulateAction}>
          <DropdownMenuSubTrigger>
            {actionLabels[simulateAction]}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            {choices.map(({ label, simulateRequest }) => (
              <WebhookTargets.MenuItem
                key={label}
                targetEvent={buildTargetEvent(simulateAction)}
                actionLabel={`${actionLabels[simulateAction]}: ${label}`}
                onSimulate={(webhookChoice) => {
                  handlers.onRun(simulateRequest, webhookChoice);
                }}
              >
                {label}
              </WebhookTargets.MenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    return (
      <WebhookTargets.MenuItem
        key={simulateAction}
        targetEvent={buildTargetEvent(simulateAction)}
        actionLabel={actionLabels[simulateAction].replace("...", "")}
        onSimulate={(webhookChoice) => {
          if (
            simulateAction === "refund" ||
            simulateAction === "answer_dispute"
          ) {
            handlers.onOpenDialog(simulateAction, webhookChoice);
            return;
          }
          handlers.onRun({ action: simulateAction }, webhookChoice);
        }}
      >
        {actionLabels[simulateAction]}
      </WebhookTargets.MenuItem>
    );
  });
}
