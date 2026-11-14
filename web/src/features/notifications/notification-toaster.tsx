import { Toaster } from "@/components/ui/sonner";
import { useNotificationPreferences } from "@/features/notifications/notification-preferences";
import {
  ToastClearAllButton,
  toastStackBottomOffsetPx,
  toastStackTopOffsetPx,
} from "@/features/notifications/toast-clear-all-button";

/** The toast stack where Settings > Notifications puts it (UI-08.4). */
export function NotificationToaster() {
  const { toastPosition } = useNotificationPreferences();
  const isAtTop = toastPosition.startsWith("top");
  const verticalOffset = isAtTop
    ? { top: toastStackTopOffsetPx }
    : { bottom: toastStackBottomOffsetPx };

  return (
    <>
      <Toaster
        position={toastPosition}
        closeButton
        offset={{ ...verticalOffset, right: 24, left: 24 }}
        mobileOffset={{ ...verticalOffset, right: 16, left: 16 }}
      />
      <ToastClearAllButton toastPosition={toastPosition} />
    </>
  );
}
