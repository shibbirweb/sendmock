import * as React from "react";

import {
  useOpenEmail,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import { useAppSettings } from "@/lib/api/hooks/use-system-queries";
import { useWebhookRuleMatch } from "@/lib/api/hooks/use-webhook-rule-queries";
import type { EmailDetail } from "@/lib/api/types";

/** What the viewer shows when a view is not counted as an open. */
export type EmailOpenTracking = {
  /** A webhook rule would send `email.opened`, so this view was not counted (EM-27.2). */
  isViewNotCounted: boolean;
  countAsOpen: () => void;
};

/**
 * Viewing an email marks it read and, when the setting allows, fires
 * `email.opened` once per view (EM-11.1, EM-11.4); not when a webhook rule
 * would report it to your app, unless the setting says to count those too.
 */
export function useEmailOpenTracking(
  email: EmailDetail | undefined,
): EmailOpenTracking {
  const { data: appSettings } = useAppSettings();
  const isOpenServed = useOperationAvailability(
    "POST /api/v1/emails/{emailId}/open",
  ).isAvailable;
  const openEmail = useOpenEmail();
  const updateEmail = useUpdateEmail();
  const trackedEmailIdRef = React.useRef<string | null>(null);
  const { mutate: sendOpen } = openEmail;
  const { mutate: sendUpdate } = updateEmail;
  const isRuleCheckNeeded =
    email !== undefined &&
    appSettings !== undefined &&
    appSettings.fire_opened_events_on_view &&
    !appSettings.count_views_with_webhook_rules;
  const ruleMatchQuery = useWebhookRuleMatch(
    { event_type: "email.opened", subject_id: email?.id ?? "" },
    isRuleCheckNeeded,
  );
  const wouldRuleReportView =
    isRuleCheckNeeded && (ruleMatchQuery.data?.webhook_rules.length ?? 0) > 0;
  const isRuleCheckPending = isRuleCheckNeeded && ruleMatchQuery.isPending;

  React.useEffect(() => {
    if (
      email === undefined ||
      appSettings === undefined ||
      isRuleCheckPending
    ) {
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
      !wouldRuleReportView &&
      (isFirstOpen || appSettings.opened_event_mode === "every_open");
    if (shouldFireOpen) {
      sendOpen({ emailId: email.id, openSource: "ui" });
    }
  }, [
    email,
    appSettings,
    isOpenServed,
    isRuleCheckPending,
    wouldRuleReportView,
    sendOpen,
    sendUpdate,
  ]);

  return {
    isViewNotCounted: wouldRuleReportView,
    countAsOpen: () => {
      if (email !== undefined) {
        sendOpen({ emailId: email.id, openSource: "manual" });
      }
    },
  };
}
