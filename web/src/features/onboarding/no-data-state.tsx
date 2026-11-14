import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * "No data yet": what shows up here, how to connect and a sample button
 * (UI-04.1, UI-04.2). Children hold the connect hint and the actions.
 */
export function NoDataState({
  icon: StateIcon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-12 text-center",
        className,
      )}
    >
      <StateIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
