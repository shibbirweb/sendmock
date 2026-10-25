import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaymentDetail } from "@/lib/api/types";
import {
  formatMinorAmount,
  parseMajorAmount,
  readMinorUnitDigits,
} from "@/lib/payments/format-money";
import {
  readRefundableMinor,
  validateRefundAmount,
} from "@/lib/payments/payment-actions";

/** Full by default, partial when changed, never more than is left (PY-07.2). Mount when opening. */
export function RefundPaymentDialog({
  paymentDetail,
  isRefunding,
  onRefund,
  onClose,
}: {
  paymentDetail: PaymentDetail;
  isRefunding: boolean;
  onRefund: (refundAmountMinor: number) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const refundableMinor = readRefundableMinor(paymentDetail);
  const minorDigits = readMinorUnitDigits(paymentDetail.currency);
  const [amountText, setAmountText] = React.useState(
    (refundableMinor / 10 ** minorDigits).toFixed(minorDigits),
  );
  const [amountError, setAmountError] = React.useState<string | null>(null);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const refundAmountMinor = parseMajorAmount(
              amountText,
              paymentDetail.currency,
            );
            const validationError = validateRefundAmount(
              refundAmountMinor,
              paymentDetail,
            );
            setAmountError(validationError);
            if (validationError === null && refundAmountMinor !== null) {
              onRefund(refundAmountMinor);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
            <DialogDescription>
              {formatMinorAmount(refundableMinor, paymentDetail.currency)} can
              be refunded.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label={`Amount (${paymentDetail.currency})`}
            fieldId={`${fieldIdPrefix}-amount`}
            errorMessage={amountError ?? undefined}
          >
            <Input
              id={`${fieldIdPrefix}-amount`}
              inputMode="decimal"
              className="font-mono"
              value={amountText}
              aria-invalid={amountError !== null}
              onChange={(changeEvent) => {
                setAmountText(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isRefunding}>
              Refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
