import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentDetail } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";

/** What was bought, with each line's total, and the metadata (PY-09.2). */
export function PaymentLineItems({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  const money = (amountMinor: number) =>
    formatMinorAmount(amountMinor, paymentDetail.currency);
  const metadataEntries = Object.entries(paymentDetail.metadata);

  return (
    <section aria-label="Line items" className="grid gap-2">
      <h3 className="text-sm font-semibold">Line items</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentDetail.line_items.map((lineItem) => (
              <TableRow key={lineItem.name}>
                <TableCell>{lineItem.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {lineItem.quantity}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(lineItem.unit_amount_minor)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(lineItem.unit_amount_minor * lineItem.quantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(paymentDetail.amount_minor)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {metadataEntries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Metadata:{" "}
          {metadataEntries.map(([metadataKey, metadataValue]) => (
            <code key={metadataKey} className="mr-2 font-mono">
              {metadataKey}={metadataValue}
            </code>
          ))}
        </p>
      )}
    </section>
  );
}
