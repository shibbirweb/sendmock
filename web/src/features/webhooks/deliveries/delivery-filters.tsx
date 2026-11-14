import { FilterChip } from "@/components/common/filter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DeliveryStatusFilter,
  deliveryStatusFilters,
} from "@/features/webhooks/deliveries/delivery-status";
import {
  type AppEventType,
  appEventTypes,
  type WebhookEndpoint,
} from "@/lib/api/types";

/** Select value for "no filter" (Select items cannot be empty). */
export const anyFilterValue = "any";

export type DeliveryFilterValues = {
  statusFilter: DeliveryStatusFilter;
  endpointId: string;
  eventType: string;
};

export const noDeliveryFilters: DeliveryFilterValues = {
  statusFilter: "all",
  endpointId: anyFilterValue,
  eventType: anyFilterValue,
};

/** Status chips, endpoint picker and event picker above the log. */
export function DeliveryFilters({
  filterValues,
  webhookEndpoints,
  onChange,
}: {
  filterValues: DeliveryFilterValues;
  webhookEndpoints: WebhookEndpoint[];
  onChange: (changedValues: Partial<DeliveryFilterValues>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {deliveryStatusFilters.map((filterOption) => (
          <FilterChip
            key={filterOption.statusFilter}
            isActive={filterValues.statusFilter === filterOption.statusFilter}
            onToggle={() => {
              onChange({ statusFilter: filterOption.statusFilter });
            }}
          >
            {filterOption.label}
          </FilterChip>
        ))}
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
        <Select
          value={filterValues.endpointId}
          onValueChange={(endpointId) => {
            onChange({ endpointId });
          }}
        >
          <SelectTrigger
            aria-label="Endpoint filter"
            className="w-full sm:w-52"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyFilterValue}>Every endpoint</SelectItem>
            {webhookEndpoints.map((webhookEndpoint) => (
              <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
                {webhookEndpoint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterValues.eventType}
          onValueChange={(eventType) => {
            onChange({ eventType });
          }}
        >
          <SelectTrigger aria-label="Event filter" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyFilterValue}>Every event</SelectItem>
            {appEventTypes.map((eventType: AppEventType) => (
              <SelectItem
                key={eventType}
                value={eventType}
                className="font-mono text-xs"
              >
                {eventType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
