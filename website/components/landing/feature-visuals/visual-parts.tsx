import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The top of a feature card where its small product scene sits, faded out
 * towards the card's text so the two never fight.
 */
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
      className={cn(
        "absolute inset-x-0 top-0 h-1/2 overflow-hidden [mask-image:linear-gradient(to_bottom,black_45%,transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const statusToneClassNames = {
  success: "bg-fd-success/15 text-fd-success",
  warning: "bg-fd-warning/15 text-fd-warning",
  error: "bg-fd-error/15 text-fd-error",
  info: "bg-fd-info/15 text-fd-info",
};

export type StatusTone = keyof typeof statusToneClassNames;

/** A small coloured label for a status such as "200", "delivered" or "retry". */
export function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        statusToneClassNames[tone],
      )}
    >
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
