import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import type { PaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import { ApiError } from "@/lib/api/api-client";
import {
  useDeletePaymentGateway,
  useResetPaymentGateway,
} from "@/lib/api/hooks/use-payment-gateway-queries";
import type { PaymentGatewayDefinition } from "@/lib/api/types";

function reportError(requestError: Error) {
  toast.error(
    requestError instanceof ApiError
      ? requestError.message
      : "Something went wrong",
  );
}

/** Reset or Delete, Cancel and Save; Save waits while a template has errors (PY-12.2, PY-12.4). */
export function GatewaySheetFooter({
  paymentGateway,
  gatewayForm,
  onClose,
}: {
  paymentGateway: PaymentGatewayDefinition;
  gatewayForm: PaymentGatewayForm;
  onClose: () => void;
}) {
  const resetGateway = useResetPaymentGateway();
  const deleteGateway = useDeletePaymentGateway();
  const [pendingAction, setPendingAction] = React.useState<
    "reset" | "delete" | null
  >(null);
  const errorCount = gatewayForm.templateErrors.length;

  return (
    <>
      <SheetFooter className="flex-row flex-wrap items-center justify-end border-t">
        {paymentGateway.is_builtin ? (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            disabled={!paymentGateway.is_modified}
            onClick={() => setPendingAction("reset")}
          >
            Reset to default
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mr-auto text-destructive"
            onClick={() => setPendingAction("delete")}
          >
            Delete
          </Button>
        )}
        {errorCount > 0 && (
          <span role="status" className="text-xs text-destructive">
            Fix {errorCount} template {errorCount === 1 ? "error" : "errors"} to
            save
          </span>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={gatewayForm.isSaving || errorCount > 0}>
          Save gateway
        </Button>
      </SheetFooter>
      <ConfirmActionDialog
        isOpen={pendingAction === "reset"}
        title={`Reset ${paymentGateway.name} to default?`}
        consequence="Its methods, credentials, redirect and notification go back to the shipped version; your changes are lost."
        confirmLabel="Reset to default"
        onConfirm={() => {
          resetGateway.mutate(paymentGateway.key, {
            onSuccess: () => {
              toast(`${paymentGateway.name} reset to default`);
              onClose();
            },
            onError: reportError,
          });
        }}
        onClose={() => setPendingAction(null)}
      />
      <ConfirmDeleteDialog
        itemName={pendingAction === "delete" ? paymentGateway.name : null}
        consequence="A gateway that payments used cannot be deleted; disable it instead."
        onConfirm={() => {
          deleteGateway.mutate(paymentGateway.key, {
            onSuccess: () => {
              toast(`${paymentGateway.name} deleted`);
              onClose();
            },
            onError: reportError,
          });
        }}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
