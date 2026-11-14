import { Link } from "@tanstack/react-router";

import { CopyButton } from "@/components/common/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { usePaymentFlows } from "@/lib/api/hooks/use-payment-flow-queries";
import { usePaymentGateways } from "@/lib/api/hooks/use-payment-gateway-queries";
import { usePaymentMethods } from "@/lib/api/hooks/use-payment-method-queries";
import {
  buildTestValueTables,
  type TestValueRow,
} from "@/lib/payments/build-test-value-rows";

function TestValuesTable({
  caption,
  valueHeading,
  testValueRows,
}: {
  caption: string;
  /** Null for methods where nothing is typed. */
  valueHeading: string | null;
  testValueRows: TestValueRow[];
}) {
  const hasCodes = testValueRows.some(
    (testValueRow) => testValueRow.codes !== "",
  );
  if (testValueRows.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1.5">
      <h4 className="text-sm font-medium">{caption}</h4>
      <div className="min-w-0 rounded-md border">
        <Table aria-label={caption}>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead className="hidden md:table-cell">Offered by</TableHead>
              {valueHeading !== null && <TableHead>{valueHeading}</TableHead>}
              <TableHead>
                {valueHeading === null ? "What happens" : "Outcome"}
              </TableHead>
              {hasCodes && (
                <TableHead className="hidden sm:table-cell">
                  OTP and PIN
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {testValueRows.map((testValueRow, rowIndex) => (
              <TableRow
                key={`${testValueRow.methodName}-${testValueRow.copyValue ?? rowIndex}`}
              >
                <TableCell>{testValueRow.methodName}</TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {testValueRow.offeredBy}
                </TableCell>
                {valueHeading !== null && (
                  <TableCell>
                    <span className="flex items-center gap-1 font-mono text-xs">
                      {testValueRow.testValue}
                      {testValueRow.copyValue !== null && (
                        <CopyButton
                          copyText={testValueRow.copyValue}
                          label={`Copy ${testValueRow.testValue ?? ""}`}
                        />
                      )}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-xs">
                  {testValueRow.outcome}
                </TableCell>
                {hasCodes && (
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {testValueRow.codes}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The test values of the enabled methods as their flows ask for them, each
 * with the gateways offering it (PY-09.4), read-only.
 */
export function PaymentTestValuesCard() {
  const testValueTables = buildTestValueTables(
    usePaymentMethods().data ?? [],
    usePaymentFlows().data ?? [],
    usePaymentGateways().data ?? [],
  );

  return (
    <SettingsSectionCard
      title="Test values"
      description="What the enabled methods accept on checkout pages, as each method's flow asks for it. Any future expiry and any CVC work with the test cards."
    >
      <TestValuesTable
        caption="Test cards"
        valueHeading="Card number"
        testValueRows={testValueTables.cardRows}
      />
      <TestValuesTable
        caption="Test numbers and codes"
        valueHeading="Number or code"
        testValueRows={testValueTables.numberRows}
      />
      <TestValuesTable
        caption="Other methods"
        valueHeading={null}
        testValueRows={testValueTables.otherRows}
      />
      <p className="text-sm text-muted-foreground">
        Merchant credentials are set per gateway in{" "}
        <Link to="/payments/gateways" className="underline underline-offset-2">
          Payments &gt; Gateways
        </Link>
        ; test values are edited in{" "}
        <Link to="/payments/methods" className="underline underline-offset-2">
          Payments &gt; Methods
        </Link>
        .
      </p>
    </SettingsSectionCard>
  );
}
