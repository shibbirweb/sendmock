import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Fills a feature card's preview panel; each scene places itself inside. */
export function VisualFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
    >
      {children}
    </div>
  );
}

const statusToneDotClassNames = {
  success: "bg-fd-success",
  warning: "bg-fd-warning",
  error: "bg-fd-error",
  info: "bg-fd-info",
};

export type StatusTone = keyof typeof statusToneDotClassNames;

/**
 * A small label for a status such as "200", "delivered" or "retry": normal
 * text with a coloured dot, so it stays readable in both themes.
 */
export function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-fd-background px-2 py-0.5 text-[10px] font-semibold text-fd-foreground">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", statusToneDotClassNames[tone])}
      />
      {children}
    </span>
  );
}

/** A rounded surface for one item in a scene: an email, a message or a request. */
export function SceneCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-fd-card p-3 text-xs shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
