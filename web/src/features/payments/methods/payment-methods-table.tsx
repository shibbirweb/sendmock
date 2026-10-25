import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countTestValues,
  methodFlowLabels,
} from "@/features/payments/methods/method-labels";
import type { PaymentMethodDefinition } from "@/lib/api/types";
import { paymentProviderLabels } from "@/lib/payments/payment-labels";

/** Every payment method with its flow, gateways, test values and state (PY-12.1). */
export function PaymentMethodsTable({
  paymentMethods,
  onEdit,
  onToggle,
}: {
  paymentMethods: PaymentMethodDefinition[];
  onEdit: (paymentMethod: PaymentMethodDefinition) => void;
  onToggle: (
    paymentMethod: PaymentMethodDefinition,
    isEnabled: boolean,
  ) => void;
}) {
  return (
    <Table aria-label="Payment methods">
      <TableHeader>
        <TableRow>
          <TableHead>Method</TableHead>
          <TableHead>Flow</TableHead>
          <TableHead className="hidden md:table-cell">Offered by</TableHead>
          <TableHead className="hidden lg:table-cell">Test values</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentMethods.map((paymentMethod) => (
          <TableRow key={paymentMethod.key} data-testid="payment-method-row">
            <TableCell>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: paymentMethod.accent }}
                />
                <span className="font-medium">{paymentMethod.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {paymentMethod.is_builtin ? "Built-in" : "Custom"}
                </Badge>
                {paymentMethod.is_modified && (
                  <Badge variant="secondary" className="text-[10px]">
                    Modified
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell>{methodFlowLabels[paymentMethod.flow].label}</TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {paymentMethod.gateway_keys.length === 0
                ? "No gateway yet"
                : paymentMethod.gateway_keys
                    .map(
                      (gatewayKey) =>
                        paymentProviderLabels[
                          gatewayKey as keyof typeof paymentProviderLabels
                        ] ?? gatewayKey,
                    )
                    .join(", ")}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
              {countTestValues(paymentMethod)}
            </TableCell>
            <TableCell>
              <Switch
                aria-label={`${paymentMethod.name} enabled`}
                checked={paymentMethod.is_enabled}
                onCheckedChange={(isEnabled) => {
                  onToggle(paymentMethod, isEnabled);
                }}
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${paymentMethod.name}`}
                onClick={() => {
                  onEdit(paymentMethod);
                }}
              >
                <PencilIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
