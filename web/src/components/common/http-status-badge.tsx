import { cn } from "@/lib/utils";

/** Status code coloured by class: 2xx success, 3xx neutral, 4xx and 5xx failure. */
export function HttpStatusBadge({ statusCode }: { statusCode: number }) {
  return (
    <span
      data-status-class={`${Math.floor(statusCode / 100)}xx`}
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium",
        statusCode < 300 && "bg-success/10 text-success",
        statusCode >= 300 &&
          statusCode < 400 &&
          "bg-muted text-muted-foreground",
        statusCode >= 400 && "bg-destructive/10 text-destructive",
      )}
    >
      {statusCode}
    </span>
  );
}
