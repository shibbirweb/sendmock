import { Link } from "@tanstack/react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/features/payments/payment-status-badge";
import type { PaymentSummary } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { formatMinorAmount } from "@/lib/payments/format-money";

function PaymentRow({ paymentSummary }: { paymentSummary: PaymentSummary }) {
  return (
    <TableRow className="relative" data-testid="payment-row">
      <TableCell className="font-medium whitespace-nowrap tabular-nums">
        <Link
          to="/payments"
          search={(previousSearch) => ({
            ...previousSearch,
            payment: paymentSummary.id,
          })}
          className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {formatMinorAmount(
            paymentSummary.amount_minor,
            paymentSummary.currency,
          )}
        </Link>
      </TableCell>
      <TableCell>
        <span className="rounded border px-1.5 text-[11px]">
          {paymentSummary.provider_name}
        </span>
      </TableCell>
      <TableCell>
        <PaymentStatusBadge paymentSummary={paymentSummary} />
      </TableCell>
      <TableCell className="hidden max-w-56 truncate md:table-cell">
        {paymentSummary.customer_name ?? paymentSummary.customer_email ?? ""}
        {paymentSummary.customer_email !== null && (
          <span className="block truncate text-xs text-muted-foreground">
            {paymentSummary.customer_email}
          </span>
        )}
      </TableCell>
      <TableCell
        className="text-right text-xs whitespace-nowrap text-muted-foreground"
        title={formatDateTime(paymentSummary.created_at)}
      >
        {formatRelativeTime(paymentSummary.created_at)}
      </TableCell>
    </TableRow>
  );
}

/** Payments newest first; each row opens its detail (PY-09.1). */
export function PaymentsTable({
  paymentSummaries,
}: {
  paymentSummaries: PaymentSummary[];
}) {
  return (
    <Table aria-label="Payments">
      <TableHeader>
        <TableRow>
          <TableHead>Amount</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Customer</TableHead>
          <TableHead className="text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentSummaries.map((paymentSummary) => (
          <PaymentRow key={paymentSummary.id} paymentSummary={paymentSummary} />
        ))}
      </TableBody>
    </Table>
  );
}
