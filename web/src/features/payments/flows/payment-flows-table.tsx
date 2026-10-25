import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentFlowDefinition } from "@/lib/api/types";
import { describeFlowSteps } from "@/lib/payments/payment-step-catalogue";

/** Every flow with its steps in order, picker tab, usage and state (PY-12.6). */
export function PaymentFlowsTable({
  paymentFlows,
  onEdit,
}: {
  paymentFlows: PaymentFlowDefinition[];
  onEdit: (paymentFlow: PaymentFlowDefinition) => void;
}) {
  return (
    <Table aria-label="Payment flows">
      <TableHeader>
        <TableRow>
          <TableHead>Flow</TableHead>
          <TableHead>Steps</TableHead>
          <TableHead className="hidden md:table-cell">Picker tab</TableHead>
          <TableHead className="hidden md:table-cell">Methods</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentFlows.map((paymentFlow) => (
          <TableRow key={paymentFlow.key} data-testid="payment-flow-row">
            <TableCell>
              <span className="flex items-center gap-2">
                <span className="font-medium">{paymentFlow.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {paymentFlow.is_builtin ? "Built-in" : "Custom"}
                </Badge>
                {paymentFlow.is_modified && (
                  <Badge variant="secondary" className="text-[10px]">
                    Modified
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="text-sm">
              {describeFlowSteps(paymentFlow.steps)}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {paymentFlow.picker_tab}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {paymentFlow.method_count === 0
                ? "None yet"
                : `${paymentFlow.method_count} ${paymentFlow.method_count === 1 ? "method" : "methods"}`}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${paymentFlow.name}`}
                onClick={() => {
                  onEdit(paymentFlow);
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
