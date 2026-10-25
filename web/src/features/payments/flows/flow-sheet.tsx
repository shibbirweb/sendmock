import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FlowStepsEditor } from "@/features/payments/flows/flow-steps-editor";
import { usePaymentFlowForm } from "@/features/payments/flows/use-payment-flow-form";
import { ApiError } from "@/lib/api/api-client";
import {
  useDeletePaymentFlow,
  useResetPaymentFlow,
} from "@/lib/api/hooks/use-payment-flow-queries";
import type { PaymentFlowDefinition } from "@/lib/api/types";

function reportError(requestError: Error) {
  toast.error(
    requestError instanceof ApiError
      ? requestError.message
      : "Something went wrong",
  );
}

/** Edit a flow step by step; built-ins reset to default, custom ones can be deleted (PY-12.6). Mount when opening. */
export function FlowSheet({
  paymentFlow,
  usedByMethodNames,
  onClose,
}: {
  paymentFlow: PaymentFlowDefinition;
  usedByMethodNames: string[];
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const flowForm = usePaymentFlowForm(paymentFlow, onClose);
  const resetPaymentFlow = useResetPaymentFlow();
  const deletePaymentFlow = useDeletePaymentFlow();
  const [pendingAction, setPendingAction] = React.useState<
    "reset" | "delete" | null
  >(null);
  const { flowInput, fieldErrors, updateInput } = flowForm;

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{paymentFlow.name}</SheetTitle>
          <SheetDescription>
            Flow, key <code className="font-mono">{paymentFlow.key}</code>.{" "}
            {usedByMethodNames.length === 0
              ? "No method uses it yet."
              : `Used by ${usedByMethodNames.join(", ")}.`}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            flowForm.save();
          }}
        >
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 pb-4">
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <FormField
                label="Name"
                fieldId={`${fieldIdPrefix}-name`}
                errorMessage={fieldErrors.name}
              >
                <Input
                  id={`${fieldIdPrefix}-name`}
                  value={flowInput.name}
                  aria-invalid={fieldErrors.name !== undefined}
                  onChange={(changeEvent) =>
                    updateInput({ name: changeEvent.target.value })
                  }
                />
              </FormField>
              <FormField
                label="Picker tab"
                fieldId={`${fieldIdPrefix}-tab`}
                hint="Its methods show under this tab on checkout pages."
                errorMessage={fieldErrors.picker_tab}
              >
                <Input
                  id={`${fieldIdPrefix}-tab`}
                  value={flowInput.picker_tab}
                  aria-invalid={fieldErrors.picker_tab !== undefined}
                  onChange={(changeEvent) =>
                    updateInput({ picker_tab: changeEvent.target.value })
                  }
                />
              </FormField>
            </div>
            <FlowStepsEditor
              flowForm={flowForm}
              previewMethodName={usedByMethodNames[0]}
            />
          </div>
          <SheetFooter className="flex-row flex-wrap items-center justify-end border-t">
            {paymentFlow.is_builtin ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                disabled={!paymentFlow.is_modified}
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
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={flowForm.isSaving}>
              Save flow
            </Button>
          </SheetFooter>
        </form>
        <ConfirmActionDialog
          isOpen={pendingAction === "reset"}
          title={`Reset ${paymentFlow.name} to default?`}
          consequence="Its name, picker tab, steps and labels go back to the shipped version; your changes are lost."
          confirmLabel="Reset to default"
          onConfirm={() => {
            resetPaymentFlow.mutate(paymentFlow.key, {
              onSuccess: () => {
                toast(`${paymentFlow.name} reset to default`);
                onClose();
              },
              onError: reportError,
            });
          }}
          onClose={() => setPendingAction(null)}
        />
        <ConfirmDeleteDialog
          itemName={pendingAction === "delete" ? paymentFlow.name : null}
          consequence="A flow that methods use cannot be deleted; delete those methods first."
          onConfirm={() => {
            deletePaymentFlow.mutate(paymentFlow.key, {
              onSuccess: () => {
                toast(`${paymentFlow.name} deleted`);
                onClose();
              },
              onError: reportError,
            });
          }}
          onClose={() => setPendingAction(null)}
        />
      </SheetContent>
    </Sheet>
  );
}
