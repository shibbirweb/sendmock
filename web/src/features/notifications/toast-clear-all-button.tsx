import { XIcon } from "lucide-react";
import { toast, useSonner } from "sonner";

import { Button } from "@/components/ui/button";
import type { ToastPosition } from "@/features/notifications/notification-preferences";
import { cn } from "@/lib/utils";

/** Toasts at the top start this far down, leaving room for the button above them. */
export const toastStackTopOffsetPx = 88;
/** Toasts at the bottom stop this far up, leaving room for the button below them. */
export const toastStackBottomOffsetPx = 64;

const horizontalClassNames: Record<string, string> = {
  right: "right-4 sm:right-6",
  left: "left-4 sm:left-6",
  center: "left-1/2 -translate-x-1/2",
};

/**
 * Shown next to the toast stack once two or more toasts are grouped there,
 * above it at the top and below it at the bottom; dismisses every toast.
 */
export function ToastClearAllButton({
  toastPosition,
}: {
  toastPosition: ToastPosition;
}) {
  const { toasts: visibleToasts } = useSonner();
  if (visibleToasts.length < 2) {
    return null;
  }
  const [verticalSide, horizontalSide = "right"] = toastPosition.split("-");

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[999999999]",
        horizontalClassNames[horizontalSide],
      )}
      style={
        verticalSide === "top"
          ? { top: toastStackTopOffsetPx - 36 }
          : { bottom: toastStackBottomOffsetPx - 40 }
      }
    >
      <Button
        variant="secondary"
        size="sm"
        className="pointer-events-auto h-7 rounded-full shadow-sm"
        onClick={() => {
          toast.dismiss();
        }}
      >
        <XIcon />
        Clear all ({visibleToasts.length})
      </Button>
    </div>
  );
}
