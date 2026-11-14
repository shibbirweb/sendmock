import { SearchIcon } from "lucide-react";

import { FilterChip } from "@/components/common/filter-chip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { variableKindOptions } from "@/features/webhooks/variables/variable-kinds";
import type { VariableKind, WebhookEndpoint } from "@/lib/api/types";

/** Scope select values besides endpoint ids. */
export const anyScope = "any";
export const globalScope = "global";

/** Scope, kind chips and a name search above the table (WH-07.11). */
export function VariableFilters({
  scopeFilter,
  kindFilter,
  nameSearch,
  webhookEndpoints,
  onScopeChange,
  onKindChange,
  onNameSearchChange,
}: {
  scopeFilter: string;
  kindFilter: VariableKind | null;
  nameSearch: string;
  webhookEndpoints: WebhookEndpoint[];
  onScopeChange: (scopeFilter: string) => void;
  onKindChange: (kindFilter: VariableKind | null) => void;
  onNameSearchChange: (nameSearch: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={nameSearch}
            placeholder="Search by name"
            aria-label="Search variables"
            className="pl-8"
            onChange={(changeEvent) => {
              onNameSearchChange(changeEvent.target.value);
            }}
          />
        </div>
        <Select value={scopeFilter} onValueChange={onScopeChange}>
          <SelectTrigger aria-label="Scope filter" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyScope}>Every scope</SelectItem>
            <SelectItem value={globalScope}>Global only</SelectItem>
            {webhookEndpoints.map((webhookEndpoint) => (
              <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
                {webhookEndpoint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          isActive={kindFilter === null}
          onToggle={() => {
            onKindChange(null);
          }}
        >
          All kinds
        </FilterChip>
        {variableKindOptions.map((kindOption) => (
          <FilterChip
            key={kindOption.value}
            isActive={kindFilter === kindOption.value}
            onToggle={() => {
              onKindChange(
                kindFilter === kindOption.value ? null : kindOption.value,
              );
            }}
          >
            {kindOption.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
