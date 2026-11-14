import { cn } from "@/lib/utils";

/** The request method in a fixed-width monospace badge. */
export function HttpMethodBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-14 shrink-0 justify-center rounded bg-muted px-1 py-0.5 font-mono text-[11px] font-semibold",
        className,
      )}
    >
      {method}
    </span>
  );
}
