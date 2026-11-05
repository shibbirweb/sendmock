import { CreditCardIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { usePageTitle } from "@/hooks/use-page-title";
import { LoadMoreRows } from "@/components/common/load-more-rows";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { PaymentDrawer } from "@/features/payments/detail/payment-drawer";
import { NewPaymentDialog } from "@/features/payments/new-payment/new-payment-dialog";
import { PaymentFilters } from "@/features/payments/payment-filters";
import { PaymentsTable } from "@/features/payments/payments-table";
import { usePaymentsSearch } from "@/features/payments/use-payments-search";
import { usePayments } from "@/lib/api/hooks/use-payment-queries";

/** Test payments: list, filters, paging and the detail drawer (PY-09.1). */
export function PaymentsPage() {
  usePageTitle("Payments");
  const paymentsSearch = usePaymentsSearch();
  const paymentsQuery = usePayments(paymentsSearch.listFilters);
  const [isNewOpen, setNewOpen] = React.useState(false);
  const loadedPages = paymentsQuery.data?.pages ?? [];
  const paymentSummaries = loadedPages.flatMap(
    (loadedPage) => loadedPage.items,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Payments</h2>
            <p className="text-sm text-muted-foreground">
              Test payments made through the emulated gateways. No real money
              moves, and only test cards are accepted.
            </p>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <PlusIcon />
            New payment
          </Button>
        </header>
        <PaymentFilters paymentsSearch={paymentsSearch} />
        <div className="min-w-0 rounded-lg border">
          {paymentsQuery.isPending && <Skeleton className="m-4 h-32" />}
          {paymentsQuery.isError && (
            <QueryErrorState
              message="Could not load the payments."
              onRetry={() => void paymentsQuery.refetch()}
            />
          )}
          {paymentsQuery.isSuccess &&
            paymentSummaries.length === 0 &&
            (paymentsSearch.hasFilters ? (
              <NoMatchState
                message="No payments match these filters."
                onClearFilter={paymentsSearch.clearFilters}
              />
            ) : (
              <NoDataState
                icon={CreditCardIcon}
                title="No payments yet"
                description="Payments appear here when your app creates one through POST /api/v1/payments, a hosted checkout (POST /api/v1/payments/checkout) or an emulated provider such as Stripe or SSLCommerz."
              />
            ))}
          {paymentSummaries.length > 0 && (
            <>
              <PaymentsTable paymentSummaries={paymentSummaries} />
              <LoadMoreRows
                shownCount={paymentSummaries.length}
                totalCount={loadedPages[0]?.total_count ?? 0}
                hasNextPage={paymentsQuery.hasNextPage}
                isFetchingNextPage={paymentsQuery.isFetchingNextPage}
                onLoadMore={() => {
                  void paymentsQuery.fetchNextPage();
                }}
              />
            </>
          )}
        </div>
      </div>
      <PaymentDrawer />
      {isNewOpen && <NewPaymentDialog onClose={() => setNewOpen(false)} />}
    </div>
  );
}
