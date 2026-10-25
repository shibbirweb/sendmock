import { SearchIcon, XIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SmsThreadFilters } from "@/features/sms/threads/filter-sms-threads";
import { cn } from "@/lib/utils";

const channelChips: {
  label: string;
  channel: SmsThreadFilters["channel"];
}[] = [
  { label: "All", channel: null },
  { label: "SMS", channel: "sms" },
  { label: "WhatsApp", channel: "whatsapp" },
];

type SmsThreadFilterBarProps = {
  threadFilters: SmsThreadFilters;
  onThreadFiltersChange: (nextThreadFilters: SmsThreadFilters) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
};

/** Search box for numbers and text, plus All / SMS / WhatsApp chips. */
export function SmsThreadFilterBar({
  threadFilters,
  onThreadFiltersChange,
  searchInputRef,
}: SmsThreadFilterBarProps) {
  return (
    <div className="grid gap-2 border-b p-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={threadFilters.searchText}
          onChange={(changeEvent) => {
            onThreadFiltersChange({
              ...threadFilters,
              searchText: changeEvent.target.value,
            });
          }}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
              keyboardEvent.currentTarget.blur();
            }
          }}
          placeholder="Search numbers or messages"
          aria-label="Search conversations"
          className="pr-8 pl-8"
        />
        {threadFilters.searchText !== "" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
            onClick={() => {
              onThreadFiltersChange({ ...threadFilters, searchText: "" });
            }}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {channelChips.map((channelChip) => {
          const isChipActive = threadFilters.channel === channelChip.channel;

          return (
            <button
              key={channelChip.label}
              type="button"
              aria-pressed={isChipActive}
              onClick={() => {
                onThreadFiltersChange({
                  ...threadFilters,
                  channel: channelChip.channel,
                });
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted",
                isChipActive &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {channelChip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
