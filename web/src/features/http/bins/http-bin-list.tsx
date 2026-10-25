import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readPresetBadge } from "@/features/http/bins/http-bin-labels";
import { NewBinDialog } from "@/features/http/bins/new-bin-dialog";
import type { HttpBin } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

function BinButton({
  label,
  detail,
  badge,
  count,
  isSelected,
  onSelect,
}: {
  label: string;
  detail: string | null;
  badge: string | null;
  count: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isSelected && "bg-muted",
      )}
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        {badge !== null && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {badge}
          </Badge>
        )}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </span>
      {detail !== null && (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </button>
  );
}

/** "All requests" and every bin with its preset, count and last request (HC-01.6). */
export function HttpBinList({
  httpBins,
  selectedBinId,
  onSelect,
}: {
  httpBins: HttpBin[];
  selectedBinId: string | null;
  onSelect: (binId: string | null) => void;
}) {
  const [isNewBinOpen, setNewBinOpen] = React.useState(false);
  const totalCount = httpBins.reduce(
    (countSoFar, httpBin) => countSoFar + httpBin.request_count,
    0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Bins</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setNewBinOpen(true);
          }}
        >
          <PlusIcon />
          New bin
        </Button>
      </div>
      <nav
        aria-label="Bin list"
        className="grid content-start gap-0.5 overflow-y-auto p-2"
      >
        <BinButton
          label="All requests"
          detail={null}
          badge={null}
          count={totalCount}
          isSelected={selectedBinId === null}
          onSelect={() => {
            onSelect(null);
          }}
        />
        {httpBins.map((httpBin) => (
          <BinButton
            key={httpBin.id}
            label={httpBin.name}
            detail={
              httpBin.last_request_at === null
                ? "No requests yet"
                : `Last ${formatRelativeTime(httpBin.last_request_at)}`
            }
            badge={readPresetBadge(httpBin.preset)}
            count={httpBin.request_count}
            isSelected={selectedBinId === httpBin.id}
            onSelect={() => {
              onSelect(httpBin.id);
            }}
          />
        ))}
      </nav>
      {isNewBinOpen && (
        <NewBinDialog
          httpBins={httpBins}
          onCreated={(createdBin) => {
            setNewBinOpen(false);
            onSelect(createdBin.id);
          }}
          onClose={() => {
            setNewBinOpen(false);
          }}
        />
      )}
    </div>
  );
}
