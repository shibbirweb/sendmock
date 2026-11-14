import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WebhookEndpoint, WebhookMetricsRange } from "@/lib/api/types";

const allEndpointsValue = "all";

/** Range and endpoint, in one row above the charts (WH-11.3). */
export function OverviewFilters({
  range,
  endpointId,
  webhookEndpoints,
  onRangeChange,
  onEndpointChange,
}: {
  range: WebhookMetricsRange;
  endpointId: string | null;
  webhookEndpoints: WebhookEndpoint[];
  onRangeChange: (nextRange: WebhookMetricsRange) => void;
  onEndpointChange: (nextEndpointId: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Range"
        value={range}
        onValueChange={(selectedRange) => {
          if (selectedRange !== "") {
            onRangeChange(selectedRange as WebhookMetricsRange);
          }
        }}
      >
        <ToggleGroupItem value="24h" className="px-3">
          24 hours
        </ToggleGroupItem>
        <ToggleGroupItem value="7d" className="px-3">
          7 days
        </ToggleGroupItem>
      </ToggleGroup>
      <Select
        value={endpointId ?? allEndpointsValue}
        onValueChange={(selectedEndpoint) => {
          onEndpointChange(
            selectedEndpoint === allEndpointsValue ? null : selectedEndpoint,
          );
        }}
      >
        <SelectTrigger aria-label="Endpoint" className="h-8 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allEndpointsValue}>All endpoints</SelectItem>
          {webhookEndpoints.map((webhookEndpoint) => (
            <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
              {webhookEndpoint.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
