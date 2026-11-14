import { toast } from "sonner";

import { readNotificationPreferences } from "@/features/notifications/notification-preferences";
import {
  type AppNotification,
  addNotifications,
} from "@/features/notifications/notification-store";
import {
  createNotificationLimiter,
  describeWithOtherCount,
  type NotificationLimiter,
} from "@/features/realtime/notification-limiter";
import {
  describeEventForNotification,
  type EventNotification,
  isEventForSelectedProject,
} from "@/features/realtime/realtime-event-effects";
import type { AppEvent } from "@/lib/api/types";

export type ToastLimiter = NotificationLimiter<EventNotification>;

/** Toasts for live events, at most one every 2 seconds, the last saying how many it stands for. */
export function createToastLimiter(): ToastLimiter {
  return createNotificationLimiter<EventNotification>(
    (eventNotification, otherCount) => {
      toast(eventNotification.title, {
        description: describeWithOtherCount(
          eventNotification.description,
          otherCount,
        ),
      });
    },
  );
}

/**
 * Puts the notable events of one flush in the bell with one update, and offers a toast for
 * those of the selected project when toasts are on (UI-08, PL-10.7).
 */
export function announceRealtimeEvents(
  appEvents: AppEvent[],
  toastLimiter: ToastLimiter,
) {
  const bellNotifications: Omit<AppNotification, "isRead">[] = [];
  // The provider sits outside the router, so it reads the top bar's choice from the URL.
  const selectedProjectKey = new URLSearchParams(window.location.search).get(
    "project",
  );
  const areToastsShown = readNotificationPreferences().areToastsShown;

  for (const appEvent of appEvents) {
    const eventNotification = describeEventForNotification(appEvent);
    if (eventNotification === null) {
      continue;
    }
    bellNotifications.push({
      ...eventNotification,
      id: appEvent.id,
      createdAt: appEvent.created_at,
    });
    if (
      areToastsShown &&
      isEventForSelectedProject(appEvent, selectedProjectKey)
    ) {
      toastLimiter.offerNotification(eventNotification);
    }
  }
  addNotifications(bellNotifications);
}
