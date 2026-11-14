import { PlusIcon } from "lucide-react";
import * as React from "react";

import { usePageTitle } from "@/hooks/use-page-title";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddFlowDialog } from "@/features/payments/flows/add-flow-dialog";
import { FlowSheet } from "@/features/payments/flows/flow-sheet";
import { PaymentFlowsTable } from "@/features/payments/flows/payment-flows-table";
import { usePaymentFlows } from "@/lib/api/hooks/use-payment-flow-queries";
import { usePaymentMethods } from "@/lib/api/hooks/use-payment-method-queries";

/** Payments > Flows: the steps customers go through, composed step by step (PY-12.6). */
export function PaymentFlowsPage() {
  usePageTitle("Flows", "Payments");
  const flowsQuery = usePaymentFlows();
  const methodsQuery = usePaymentMethods();
  const [isAddOpen, setAddOpen] = React.useState(false);
  const [editedKey, setEditedKey] = React.useState<string | null>(null);
  const paymentFlows = flowsQuery.data ?? [];
  const editedFlow = paymentFlows.find(
    (paymentFlow) => paymentFlow.key === editedKey,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Payment flows</h2>
            <p className="text-sm text-muted-foreground">
              The steps a customer goes through on test checkout pages. Each
              method runs one flow.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add flow
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {flowsQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : flowsQuery.isError ? (
            <QueryErrorState
              message="Could not load the payment flows."
              onRetry={() => void flowsQuery.refetch()}
            />
          ) : (
            <PaymentFlowsTable
              paymentFlows={paymentFlows}
              onEdit={(paymentFlow) => setEditedKey(paymentFlow.key)}
            />
          )}
        </div>
      </div>
      {isAddOpen && (
        <AddFlowDialog
          paymentFlows={paymentFlows}
          onCreated={(createdFlow) => {
            setAddOpen(false);
            setEditedKey(createdFlow.key);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editedFlow !== undefined && (
        <FlowSheet
          key={editedFlow.key}
          paymentFlow={editedFlow}
          usedByMethodNames={(methodsQuery.data ?? [])
            .filter((paymentMethod) => paymentMethod.flow === editedFlow.key)
            .map((paymentMethod) => paymentMethod.name)}
          onClose={() => setEditedKey(null)}
        />
      )}
    </div>
  );
}
