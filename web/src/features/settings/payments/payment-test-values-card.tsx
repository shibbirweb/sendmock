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
import { usePaymentMethods } from "@/lib/api/hooks/use-payment-method-queries";
import {
  describeTestOutcome,
  formatCardNumber,
} from "@/lib/payments/test-instruments";

type TestValueRow = {
  methodName: string;
  testValue: string;
  copyValue: string;
  outcome: string;
  codes: string;
};

function TestValuesTable({
  caption,
  valueHeading,
  testValueRows,
  hasCodes,
}: {
  caption: string;
  valueHeading: string;
  testValueRows: TestValueRow[];
  hasCodes: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <h4 className="text-sm font-medium">{caption}</h4>
      <div className="min-w-0 rounded-md border">
        <Table aria-label={caption}>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>{valueHeading}</TableHead>
              <TableHead>Outcome</TableHead>
              {hasCodes && (
                <TableHead className="hidden sm:table-cell">
                  OTP / PIN
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {testValueRows.map((testValueRow) => (
              <TableRow
                key={`${testValueRow.methodName}-${testValueRow.copyValue}`}
              >
                <TableCell>{testValueRow.methodName}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 font-mono text-xs">
                    {testValueRow.testValue}
                    <CopyButton
                      copyText={testValueRow.copyValue}
                      label={`Copy ${testValueRow.testValue}`}
                    />
                  </span>
                </TableCell>
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

/** The test cards and test numbers of the enabled methods (PY-09.4), read-only. */
export function PaymentTestValuesCard() {
  const enabledMethods = (usePaymentMethods().data ?? []).filter(
    (paymentMethod) => paymentMethod.is_enabled,
  );
  const cardRows = enabledMethods.flatMap((paymentMethod) =>
    paymentMethod.test_cards.map((testCard) => ({
      methodName: paymentMethod.name,
      testValue: formatCardNumber(testCard.number),
      copyValue: testCard.number,
      outcome: describeTestOutcome(testCard),
      codes: "",
    })),
  );
  const numberRows = enabledMethods.flatMap((paymentMethod) =>
    paymentMethod.test_numbers.map((testNumber) => ({
      methodName: paymentMethod.name,
      testValue: testNumber.number,
      copyValue: testNumber.number,
      outcome: describeTestOutcome(testNumber),
      codes: `${paymentMethod.otp} / ${paymentMethod.pin}`,
    })),
  );

  return (
    <SettingsSectionCard
      title="Test values"
      description="What the enabled methods accept on checkout pages. Any future expiry and any CVC work with the test cards."
    >
      <TestValuesTable
        caption="Test cards"
        valueHeading="Card number"
        testValueRows={cardRows}
        hasCodes={false}
      />
      <TestValuesTable
        caption="Test numbers"
        valueHeading="Number or code"
        testValueRows={numberRows}
        hasCodes
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
