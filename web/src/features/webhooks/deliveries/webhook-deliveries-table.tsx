import { Link } from "@tanstack/react-router";

import {
  CheckableTableRow,
  CheckColumnHead,
} from "@/components/common/checkable-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryStatusBadge } from "@/features/webhooks/deliveries/delivery-status-badge";
import type { CheckedItems } from "@/hooks/use-checked-items";
import type { WebhookDelivery } from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMs,
  formatRelativeTime,
} from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const triggerClassNames: Record<WebhookDelivery["trigger"], string> = {
  auto: "text-muted-foreground",
  manual: "border-primary/40",
  replay: "border-primary/40",
  chosen: "border-primary/40",
};

function DeliveryRow({
  webhookDelivery,
  checkedDeliveries,
}: {
  webhookDelivery: WebhookDelivery;
  checkedDeliveries: CheckedItems;
}) {
  return (
    <CheckableTableRow
      itemId={webhookDelivery.id}
      itemLabel={`${webhookDelivery.event_type} delivery to ${webhookDelivery.endpoint_name}`}
      checkedItems={checkedDeliveries}
    >
      <TableCell className="whitespace-nowrap">
        <Link
          to="/webhooks/deliveries"
          search={{ delivery: webhookDelivery.id }}
          title={formatDateTime(webhookDelivery.created_at)}
          className="rounded-sm text-xs after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {formatRelativeTime(webhookDelivery.created_at)}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {webhookDelivery.event_type}
      </TableCell>
      <TableCell className="hidden max-w-48 truncate sm:table-cell">
        {webhookDelivery.endpoint_name}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span
          className={cn(
            "rounded border px-1.5 text-[11px]",
            triggerClassNames[webhookDelivery.trigger],
          )}
        >
          {webhookDelivery.trigger}
        </span>
        {webhookDelivery.is_edited && (
          <span className="ml-1 rounded border border-primary/40 px-1.5 text-[11px]">
            edited
          </span>
        )}
      </TableCell>
      <TableCell>
        <DeliveryStatusBadge webhookDelivery={webhookDelivery} />
      </TableCell>
      <TableCell className="hidden text-right text-xs tabular-nums lg:table-cell">
        {webhookDelivery.duration_ms === null
          ? ""
          : formatDurationMs(webhookDelivery.duration_ms)}
      </TableCell>
      <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
        {webhookDelivery.attempt}
      </TableCell>
    </CheckableTableRow>
  );
}

/** The delivery log; each row opens its detail (WH-03.7). */
export function WebhookDeliveriesTable({
  webhookDeliveries,
  checkedDeliveries,
}: {
  webhookDeliveries: WebhookDelivery[];
  checkedDeliveries: CheckedItems;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <CheckColumnHead />
          <TableHead>Time</TableHead>
          <TableHead>Event</TableHead>
          <TableHead className="hidden sm:table-cell">Endpoint</TableHead>
          <TableHead className="hidden md:table-cell">Trigger</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden text-right lg:table-cell">
            Duration
          </TableHead>
          <TableHead className="hidden text-right md:table-cell">
            Attempt
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhookDeliveries.map((webhookDelivery) => (
          <DeliveryRow
            key={webhookDelivery.id}
            webhookDelivery={webhookDelivery}
            checkedDeliveries={checkedDeliveries}
          />
        ))}
      </TableBody>
    </Table>
  );
}
