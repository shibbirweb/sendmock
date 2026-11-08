import * as React from "react";

import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import { useOpenSms } from "@/lib/api/hooks/use-sms-queries";
import { useAppSettings } from "@/lib/api/hooks/use-system-queries";
import type { SmsMessage } from "@/lib/api/types";

/**
 * An outbound, delivered message that scrolls into view counts as read by the
 * recipient: it fires `sms.opened` once per view when the opened-events
 * setting allows (SM-10.1). Inbound messages never fire (SM-10.2).
 */
export function useSmsOpenOnView(
  smsMessage: SmsMessage,
  bubbleElementRef: React.RefObject<HTMLElement | null>,
) {
  const { data: appSettings } = useAppSettings();
  const isOpenServed = useOperationAvailability(
    "POST /api/v1/sms/{smsId}/open",
  ).isAvailable;
  const { mutate: sendOpen } = useOpenSms();
  const hasFiredRef = React.useRef(false);

  const isFirstOpen = smsMessage.open_count === 0;
  const shouldFireOnView =
    isOpenServed &&
    appSettings !== undefined &&
    appSettings.fire_opened_events_on_view &&
    smsMessage.direction === "outbound" &&
    smsMessage.status === "delivered" &&
    (isFirstOpen || appSettings.opened_event_mode === "every_open");

  React.useEffect(() => {
    const bubbleElement = bubbleElementRef.current;
    const canObserve = typeof IntersectionObserver !== "undefined";
    if (
      !shouldFireOnView ||
      hasFiredRef.current ||
      bubbleElement === null ||
      !canObserve
    ) {
      return undefined;
    }

    const visibilityObserver = new IntersectionObserver(
      (observedEntries) => {
        const isVisible = observedEntries.some(
          (observedEntry) => observedEntry.isIntersecting,
        );
        if (!isVisible || hasFiredRef.current) {
          return;
        }

        hasFiredRef.current = true;
        visibilityObserver.disconnect();
        sendOpen({ smsId: smsMessage.id, openSource: "ui" });
      },
      { threshold: 0.6 },
    );
    visibilityObserver.observe(bubbleElement);

    return () => {
      visibilityObserver.disconnect();
    };
  }, [shouldFireOnView, bubbleElementRef, sendOpen, smsMessage.id]);
}
