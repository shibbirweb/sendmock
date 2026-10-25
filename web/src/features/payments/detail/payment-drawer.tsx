import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentLineItems } from "@/features/payments/detail/payment-line-items";
import { PaymentNotifications } from "@/features/payments/detail/payment-notifications";
import { PaymentOverview } from "@/features/payments/detail/payment-overview";
import { PaymentRedirects } from "@/features/payments/detail/payment-redirects";
import { PaymentSimulateMenu } from "@/features/payments/detail/payment-simulate-menu";
import { PaymentTimeline } from "@/features/payments/detail/payment-timeline";
import { usePaymentsSearch } from "@/features/payments/use-payments-search";
import { usePayment } from "@/lib/api/hooks/use-payment-queries";

function PaymentDrawerContent({ paymentId }: { paymentId: string }) {
  const paymentQuery = usePayment(paymentId);
  if (paymentQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (paymentQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        This payment no longer exists.
      </p>
    );
  }

  const paymentDetail = paymentQuery.data;

  return (
    <div className="grid min-w-0 gap-5 px-4 pb-6">
      <PaymentOverview paymentDetail={paymentDetail} />
      <PaymentSimulateMenu paymentDetail={paymentDetail} />
      <Separator />
      <PaymentLineItems paymentDetail={paymentDetail} />
      <PaymentTimeline paymentDetail={paymentDetail} />
      <PaymentRedirects paymentDetail={paymentDetail} />
      <PaymentNotifications paymentDetail={paymentDetail} />
    </div>
  );
}

/** One payment's detail, open while `?payment=` is set (PY-09.2). */
export function PaymentDrawer() {
  const paymentsSearch = usePaymentsSearch();
  const openPaymentId = paymentsSearch.paymentsSearch.payment;

  return (
    <Sheet
      open={openPaymentId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          paymentsSearch.updateSearch({ payment: undefined });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Payment</SheetTitle>
          <SheetDescription>
            Test payment: no real money moved.
          </SheetDescription>
        </SheetHeader>
        {openPaymentId !== undefined && (
          <PaymentDrawerContent key={openPaymentId} paymentId={openPaymentId} />
        )}
      </SheetContent>
    </Sheet>
  );
}
