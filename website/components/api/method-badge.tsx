import { cn } from "@/lib/utils";

/** The HTTP method, monospaced; writes stand out from reads. */
export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold",
        method === "GET"
          ? "bg-fd-secondary text-fd-secondary-foreground"
          : "bg-fd-primary text-fd-primary-foreground",
      )}
    >
      {method}
    </span>
  );
}
