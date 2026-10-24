import { XIcon } from "lucide-react";
import { toast, useSonner } from "sonner";

import { Button } from "@/components/ui/button";

/** The toast stack starts this far from the top, leaving room for the button. */
export const toastStackTopOffsetPx = 88;

/**
 * Shown above the toast stack once two or more toasts are grouped there;
 * dismisses every toast at once.
 */
export function ToastClearAllButton() {
  const { toasts: visibleToasts } = useSonner();

  if (visibleToasts.length < 2) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-4 z-[999999999] sm:right-6"
      style={{ top: toastStackTopOffsetPx - 36 }}
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
