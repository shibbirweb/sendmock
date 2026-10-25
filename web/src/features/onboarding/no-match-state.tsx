import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A search or filter matched nothing: say so and offer to clear it (UI-04.4). */
export function NoMatchState({
  message,
  onClearFilter,
  clearLabel = "Clear filter",
  className,
}: {
  message: string;
  onClearFilter: () => void;
  clearLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <SearchXIcon
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onClearFilter}>
        {clearLabel}
      </Button>
    </div>
  );
}
