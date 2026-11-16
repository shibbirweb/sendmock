import { cn } from "@/lib/utils";

/** The dot beside an item nobody opened yet, named Unread for screen readers. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Unread"
      className={cn("size-2 shrink-0 rounded-full bg-primary", className)}
    />
  );
}
