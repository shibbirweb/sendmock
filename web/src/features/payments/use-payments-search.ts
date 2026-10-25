import { useNavigate, useSearch } from "@tanstack/react-router";

import type { PaymentListFilters } from "@/lib/api/types";
import { paymentStatusFilters } from "@/lib/payments/payment-labels";
import type { PaymentsSearchParams } from "@/routes/payments";

/** The payments filters and open payment, kept in the URL (PY-09.1). */
export function usePaymentsSearch() {
  const paymentsSearch = useSearch({ from: "/payments" });
  const navigate = useNavigate({ from: "/payments" });

  const updateSearch = (changedParams: Partial<PaymentsSearchParams>) => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, ...changedParams }),
    });
  };
  const listFilters: PaymentListFilters = {
    status: paymentStatusFilters
      .find(
        (filterOption) => filterOption.statusFilter === paymentsSearch.status,
      )
      ?.statuses?.join(","),
    provider: paymentsSearch.provider,
    currency: paymentsSearch.currency,
  };

  return {
    paymentsSearch,
    listFilters,
    hasFilters:
      paymentsSearch.status !== undefined ||
      paymentsSearch.provider !== undefined ||
      paymentsSearch.currency !== undefined,
    updateSearch,
    clearFilters: () => {
      updateSearch({
        status: undefined,
        provider: undefined,
        currency: undefined,
      });
    },
  };
}
