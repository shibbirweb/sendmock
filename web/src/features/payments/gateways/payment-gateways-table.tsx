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
import type { PaymentGatewayDefinition } from "@/lib/api/types";

/** Every gateway with its methods, notification endpoint and state (PY-12.2). */
export function PaymentGatewaysTable({
  paymentGateways,
  readMethodName,
  readEndpointName,
  onEdit,
  onToggle,
}: {
  paymentGateways: PaymentGatewayDefinition[];
  readMethodName: (methodKey: string) => string;
  readEndpointName: (endpointId: string | null) => string;
  onEdit: (paymentGateway: PaymentGatewayDefinition) => void;
  onToggle: (
    paymentGateway: PaymentGatewayDefinition,
    isEnabled: boolean,
  ) => void;
}) {
  return (
    <Table aria-label="Payment gateways">
      <TableHeader>
        <TableRow>
          <TableHead>Gateway</TableHead>
          <TableHead className="hidden sm:table-cell">Key</TableHead>
          <TableHead className="hidden md:table-cell">
            Methods offered
          </TableHead>
          <TableHead className="hidden lg:table-cell">
            Notifications to
          </TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentGateways.map((paymentGateway) => (
          <TableRow key={paymentGateway.key} data-testid="payment-gateway-row">
            <TableCell>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: paymentGateway.accent }}
                />
                <span className="font-medium">{paymentGateway.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {paymentGateway.is_builtin ? "Built-in" : "Custom"}
                </Badge>
                {paymentGateway.is_modified && (
                  <Badge variant="secondary" className="text-[10px]">
                    Modified
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="hidden font-mono text-xs sm:table-cell">
              {paymentGateway.key}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
              {paymentGateway.method_keys.map(readMethodName).join(", ")}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
              {readEndpointName(paymentGateway.notification_endpoint_id)}
            </TableCell>
            <TableCell>
              <Switch
                aria-label={`${paymentGateway.name} enabled`}
                checked={paymentGateway.is_enabled}
                onCheckedChange={(isEnabled) =>
                  onToggle(paymentGateway, isEnabled)
                }
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${paymentGateway.name}`}
                onClick={() => onEdit(paymentGateway)}
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
