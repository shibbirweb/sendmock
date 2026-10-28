import * as React from "react";
import { toast } from "sonner";

import { readNotificationPreferences } from "@/features/notifications/notification-preferences";
import { addNotification } from "@/features/notifications/notification-store";
import { markUpdateVersionAnnounced } from "@/features/updates/announced-update-versions";
import {
  useAppSettings,
  useDailyUpdateCheck,
} from "@/lib/api/hooks/use-system-queries";

/**
 * With the Daily mode, checks on start and once a day and raises one header
 * notification per new version (PL-05.10, PL-05.11). Renders nothing.
 */
export function DailyUpdateNotifier() {
  const appSettingsQuery = useAppSettings();
  const isDailyCheckOn = appSettingsQuery.data?.update_check_mode === "daily";
  const dailyUpdateCheck = useDailyUpdateCheck({ isEnabled: isDailyCheckOn });
  const availableRelease = dailyUpdateCheck.data?.available_release ?? null;

  React.useEffect(() => {
    if (!isDailyCheckOn || availableRelease === null) {
      return;
    }
    if (!markUpdateVersionAnnounced(availableRelease.version)) {
      return;
    }
    const notificationTitle = `SendMock ${availableRelease.version} is available`;
    const notificationDescription =
      "See the release notes in Settings > About.";
    addNotification({
      id: `update-${availableRelease.version}`,
      area: "update",
      title: notificationTitle,
      description: notificationDescription,
      link: { kind: "about" },
      createdAt: new Date().toISOString(),
    });
    if (readNotificationPreferences().areToastsShown) {
      toast(notificationTitle, { description: notificationDescription });
    }
  }, [isDailyCheckOn, availableRelease]);

  return null;
}
