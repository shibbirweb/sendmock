import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { usePageTitle } from "@/hooks/use-page-title";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddGatewayDialog } from "@/features/payments/gateways/add-gateway-dialog";
import { GatewaySheet } from "@/features/payments/gateways/gateway-sheet";
import { PaymentGatewaysTable } from "@/features/payments/gateways/payment-gateways-table";
import { toGatewayInput } from "@/features/payments/gateways/use-payment-gateway-form";
import {
  usePaymentGateways,
  useSavePaymentGateway,
} from "@/lib/api/hooks/use-payment-gateway-queries";
import { usePaymentMethods } from "@/lib/api/hooks/use-payment-method-queries";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";

/** Payments > Gateways: the emulated providers and how each behaves (PY-12.2). */
export function PaymentGatewaysPage() {
  usePageTitle("Gateways", "Payments");
  const gatewaysQuery = usePaymentGateways();
  const paymentMethods = usePaymentMethods().data ?? [];
  const webhookEndpoints = useWebhookEndpoints().data ?? [];
  const saveGateway = useSavePaymentGateway();
  const [isAddOpen, setAddOpen] = React.useState(false);
  const [editedKey, setEditedKey] = React.useState<string | null>(null);
  const paymentGateways = gatewaysQuery.data ?? [];
  const editedGateway = paymentGateways.find(
    (paymentGateway) => paymentGateway.key === editedKey,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Payment gateways</h2>
            <p className="text-sm text-muted-foreground">
              The providers SendMock emulates: what their checkout offers, what
              they send back to your app, and the notifications they post.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add gateway
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {gatewaysQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : gatewaysQuery.isError ? (
            <QueryErrorState
              message="Could not load the gateways."
              onRetry={() => void gatewaysQuery.refetch()}
            />
          ) : (
            <PaymentGatewaysTable
              paymentGateways={paymentGateways}
              readMethodName={(methodKey) =>
                paymentMethods.find(
                  (paymentMethod) => paymentMethod.key === methodKey,
                )?.name ?? methodKey
              }
              readEndpointName={(endpointId) =>
                webhookEndpoints.find(
                  (webhookEndpoint) => webhookEndpoint.id === endpointId,
                )?.name ?? "No endpoint"
              }
              onEdit={(paymentGateway) => setEditedKey(paymentGateway.key)}
              onToggle={(paymentGateway, isEnabled) => {
                saveGateway.mutate(
                  { ...toGatewayInput(paymentGateway), is_enabled: isEnabled },
                  {
                    onSuccess: () => {
                      toast(
                        `${paymentGateway.name} ${isEnabled ? "enabled" : "disabled"}`,
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
        <AddGatewayDialog
          paymentGateways={paymentGateways}
          onCreated={(createdGateway) => {
            setAddOpen(false);
            setEditedKey(createdGateway.key);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editedGateway !== undefined && (
        <GatewaySheet
          key={editedGateway.key}
          paymentGateway={editedGateway}
          onClose={() => setEditedKey(null)}
        />
      )}
    </div>
  );
}
