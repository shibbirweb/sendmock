import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** "start" keeps the label inside the sidebar for the first icon in a row. */
const tooltipAlignmentClassNames = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-0",
};

/**
 * An icon that shows its label above it while the surrounding link is hovered
 * or focused. Fumadocs' icon links only set `aria-label`, so screen readers
 * already hear the label; the tooltip is for sighted mouse and keyboard users.
 */
export function IconWithTooltip({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: keyof typeof tooltipAlignmentClassNames;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex">
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-full z-50 mb-2.5 rounded-md border bg-fd-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-fd-popover-foreground opacity-0 shadow-md transition-opacity in-[a:focus-visible]:opacity-100 in-[a:hover]:opacity-100",
          tooltipAlignmentClassNames[align],
        )}
      >
        {label}
      </span>
    </span>
  );
}
