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
import { MethodFlowFields } from "@/features/payments/methods/method-flow-fields";
import { usePaymentMethodForm } from "@/features/payments/methods/use-payment-method-form";
import { ApiError } from "@/lib/api/api-client";
import {
  useDeletePaymentMethod,
  useResetPaymentMethod,
} from "@/lib/api/hooks/use-payment-method-queries";
import type {
  PaymentFlowDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";

/** Edit a method; built-ins reset to default, custom ones can be deleted (PY-12.1). Mount when opening. */
export function MethodSheet({
  paymentMethod,
  paymentFlow,
  onClose,
}: {
  paymentMethod: PaymentMethodDefinition;
  paymentFlow: PaymentFlowDefinition | undefined;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const methodForm = usePaymentMethodForm(paymentMethod, paymentFlow, onClose);
  const resetPaymentMethod = useResetPaymentMethod();
  const deletePaymentMethod = useDeletePaymentMethod();
  const [pendingAction, setPendingAction] = React.useState<
    "reset" | "delete" | null
  >(null);
  const { methodInput, fieldErrors, updateInput } = methodForm;
  const reportError = (requestError: Error) => {
    toast.error(
      requestError instanceof ApiError
        ? requestError.message
        : "Something went wrong",
    );
  };

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{paymentMethod.name}</SheetTitle>
          <SheetDescription>
            {paymentFlow?.name ?? paymentMethod.flow} flow, key{" "}
            <code className="font-mono">{paymentMethod.key}</code>
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            methodForm.save();
          }}
        >
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-start gap-3">
              <FormField
                label="Name"
                fieldId={`${fieldIdPrefix}-name`}
                errorMessage={fieldErrors.name}
              >
                <Input
                  id={`${fieldIdPrefix}-name`}
                  value={methodInput.name}
                  aria-invalid={fieldErrors.name !== undefined}
                  onChange={(changeEvent) =>
                    updateInput({ name: changeEvent.target.value })
                  }
                />
              </FormField>
              <FormField
                label="Accent"
                fieldId={`${fieldIdPrefix}-accent`}
                errorMessage={fieldErrors.accent}
              >
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Accent colour"
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
                    value={methodInput.accent}
                    onChange={(changeEvent) =>
                      updateInput({ accent: changeEvent.target.value })
                    }
                  />
                  <Input
                    id={`${fieldIdPrefix}-accent`}
                    className="font-mono text-xs"
                    value={methodInput.accent}
                    onChange={(changeEvent) =>
                      updateInput({ accent: changeEvent.target.value })
                    }
                  />
                </div>
              </FormField>
            </div>
            <MethodFlowFields
              paymentFlow={paymentFlow}
              methodInput={methodInput}
              fieldErrors={fieldErrors}
              onChange={updateInput}
            />
          </div>
          <SheetFooter className="flex-row flex-wrap items-center justify-end border-t">
            {paymentMethod.is_builtin ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                disabled={!paymentMethod.is_modified}
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
            <Button type="submit" disabled={methodForm.isSaving}>
              Save method
            </Button>
          </SheetFooter>
        </form>
        <ConfirmActionDialog
          isOpen={pendingAction === "reset"}
          title={`Reset ${paymentMethod.name} to default?`}
          consequence="Its name, colour and test values go back to the shipped version; your changes are lost."
          confirmLabel="Reset to default"
          onConfirm={() => {
            resetPaymentMethod.mutate(paymentMethod.key, {
              onSuccess: () => {
                toast(`${paymentMethod.name} reset to default`);
                onClose();
              },
              onError: reportError,
            });
          }}
          onClose={() => setPendingAction(null)}
        />
        <ConfirmDeleteDialog
          itemName={pendingAction === "delete" ? paymentMethod.name : null}
          consequence="Checkout pages stop offering it. A method that payments used cannot be deleted; disable it instead."
          onConfirm={() => {
            deletePaymentMethod.mutate(paymentMethod.key, {
              onSuccess: () => {
                toast(`${paymentMethod.name} deleted`);
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
