import * as React from "react";

import {
  useOpenEmail,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import { useAppSettings } from "@/lib/api/hooks/use-system-queries";
import type { EmailDetail } from "@/lib/api/types";

/**
 * Viewing an email marks it read and, when the setting allows, fires
 * `email.opened` once per view (EM-11.1, EM-11.4).
 */
export function useEmailOpenTracking(email: EmailDetail | undefined) {
  const { data: appSettings } = useAppSettings();
  const isOpenServed = useOperationAvailability(
    "POST /api/v1/emails/{emailId}/open",
  ).isAvailable;
  const openEmail = useOpenEmail();
  const updateEmail = useUpdateEmail();
  const trackedEmailIdRef = React.useRef<string | null>(null);
  const { mutate: sendOpen } = openEmail;
  const { mutate: sendUpdate } = updateEmail;

  React.useEffect(() => {
    if (email === undefined || appSettings === undefined) {
      return;
    }
    if (trackedEmailIdRef.current === email.id) {
      return;
    }
    trackedEmailIdRef.current = email.id;

    if (!email.is_read) {
      sendUpdate({ emailId: email.id, emailUpdate: { is_read: true } });
    }

    const isFirstOpen = email.open_count === 0;
    const shouldFireOpen =
      isOpenServed &&
      appSettings.fire_opened_events_on_view &&
      (isFirstOpen || appSettings.opened_event_mode === "every_open");
    if (shouldFireOpen) {
      sendOpen({ emailId: email.id, openSource: "ui" });
    }
  }, [email, appSettings, isOpenServed, sendOpen, sendUpdate]);
}
