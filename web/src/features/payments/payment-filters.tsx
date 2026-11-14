import { FilterChip } from "@/components/common/filter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { usePaymentsSearch } from "@/features/payments/use-payments-search";
import { usePaymentGateways } from "@/lib/api/hooks/use-payment-gateway-queries";
import { paymentStatusFilters } from "@/lib/payments/payment-labels";

const anyValue = "any";
/** Currencies the emulated providers settle in (PY-02.3). */
export const paymentCurrencies = ["USD", "EUR", "GBP", "BDT", "INR", "JPY"];

/** Status chips, a provider picker and a currency picker (PY-09.1). */
export function PaymentFilters({
  paymentsSearch,
}: {
  paymentsSearch: ReturnType<typeof usePaymentsSearch>;
}) {
  const { status, provider, currency } = paymentsSearch.paymentsSearch;
  const paymentGateways = usePaymentGateways().data ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {paymentStatusFilters.map((filterOption) => (
          <FilterChip
            key={filterOption.statusFilter}
            isActive={(status ?? "all") === filterOption.statusFilter}
            onToggle={() => {
              paymentsSearch.updateSearch({
                status:
                  filterOption.statusFilter === "all"
                    ? undefined
                    : filterOption.statusFilter,
              });
            }}
          >
            {filterOption.label}
          </FilterChip>
        ))}
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
        <Select
          value={provider ?? anyValue}
          onValueChange={(selectedProvider) => {
            paymentsSearch.updateSearch({
              provider:
                selectedProvider === anyValue ? undefined : selectedProvider,
            });
          }}
        >
          <SelectTrigger aria-label="Provider" className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyValue}>All providers</SelectItem>
            {paymentGateways.map((paymentGateway) => (
              <SelectItem key={paymentGateway.key} value={paymentGateway.key}>
                {paymentGateway.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={currency ?? anyValue}
          onValueChange={(selectedCurrency) => {
            paymentsSearch.updateSearch({
              currency:
                selectedCurrency === anyValue ? undefined : selectedCurrency,
            });
          }}
        >
          <SelectTrigger aria-label="Currency" className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyValue}>All currencies</SelectItem>
            {paymentCurrencies.map((currencyCode) => (
              <SelectItem key={currencyCode} value={currencyCode}>
                {currencyCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
