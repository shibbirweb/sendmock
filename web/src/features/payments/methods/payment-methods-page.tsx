import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMethodDialog } from "@/features/payments/methods/add-method-dialog";
import { MethodSheet } from "@/features/payments/methods/method-sheet";
import { PaymentMethodsTable } from "@/features/payments/methods/payment-methods-table";
import { toMethodInput } from "@/features/payments/methods/use-payment-method-form";
import {
  usePaymentMethods,
  useSavePaymentMethod,
} from "@/lib/api/hooks/use-payment-method-queries";

/** Payments > Methods: what checkout pages offer, and their test values (PY-12.1). */
export function PaymentMethodsPage() {
  const methodsQuery = usePaymentMethods();
  const savePaymentMethod = useSavePaymentMethod();
  const [isAddOpen, setAddOpen] = React.useState(false);
  const [editedKey, setEditedKey] = React.useState<string | null>(null);
  const paymentMethods = methodsQuery.data ?? [];
  const editedMethod = paymentMethods.find(
    (paymentMethod) => paymentMethod.key === editedKey,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Payment methods</h2>
            <p className="text-sm text-muted-foreground">
              What customers pay with on test checkout pages, and the test
              values each one accepts.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add method
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {methodsQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : (
            <PaymentMethodsTable
              paymentMethods={paymentMethods}
              onEdit={(paymentMethod) => setEditedKey(paymentMethod.key)}
              onToggle={(paymentMethod, isEnabled) => {
                savePaymentMethod.mutate(
                  {
                    methodInput: {
                      ...toMethodInput(paymentMethod),
                      is_enabled: isEnabled,
                    },
                    isNew: false,
                  },
                  {
                    onSuccess: () => {
                      toast(
                        `${paymentMethod.name} ${isEnabled ? "enabled" : "disabled"}`,
                      );
                    },
                  },
                );
              }}
            />
          )}
        </div>
      </div>
      {isAddOpen && (
        <AddMethodDialog
          paymentMethods={paymentMethods}
          onCreated={(createdMethod) => {
            setAddOpen(false);
            setEditedKey(createdMethod.key);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editedMethod !== undefined && (
        <MethodSheet
          key={editedMethod.key}
          paymentMethod={editedMethod}
          onClose={() => setEditedKey(null)}
        />
      )}
    </div>
  );
}
