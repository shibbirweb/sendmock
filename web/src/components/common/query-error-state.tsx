import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What a screen shows when its data could not be loaded (UI-07.2): the
 * message and Try again, announced to screen readers.
 */
export function QueryErrorState({
  message,
  onRetry,
  className,
}: {
  /** "Could not load the rules." */
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
