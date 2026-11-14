import type * as React from "react";

import { cn } from "@/lib/utils";

/** Rounded toggle used for quick filters above lists and tables. */
export function FilterChip({
  isActive,
  onToggle,
  children,
}: {
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onToggle}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted",
        isActive &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {children}
    </button>
  );
}
