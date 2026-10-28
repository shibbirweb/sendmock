import * as React from "react";

/** Where a notification leads. */
export type NotificationLink =
  | { kind: "email"; emailId: string }
  | { kind: "sms"; threadId: string }
  | { kind: "delivery"; deliveryId: string }
  | { kind: "about" };

export type AppNotification = {
  id: string;
  /** What it is about, for its icon. */
  area: "email" | "sms" | "webhook" | "update";
  title: string;
  description: string;
  link: NotificationLink | null;
  createdAt: string;
  isRead: boolean;
};

/** The bell keeps this many, newest first, for the session (UI-08.3). */
export const maxNotifications = 50;

type NotificationState = { notifications: AppNotification[] };

let notificationState: NotificationState = { notifications: [] };
const notificationListeners = new Set<() => void>();

function setNotificationState(nextState: NotificationState) {
  notificationState = nextState;
  for (const notificationListener of notificationListeners) {
    notificationListener();
  }
}

export function addNotification(notification: Omit<AppNotification, "isRead">) {
  setNotificationState({
    notifications: [
      { ...notification, isRead: false },
      ...notificationState.notifications,
    ].slice(0, maxNotifications),
  });
}

export function markAllNotificationsRead() {
  if (
    notificationState.notifications.every((notification) => notification.isRead)
  ) {
    return;
  }
  setNotificationState({
    notifications: notificationState.notifications.map((notification) => ({
      ...notification,
      isRead: true,
    })),
  });
}

export function clearNotifications() {
  setNotificationState({ notifications: [] });
}

export function readNotificationState(): NotificationState {
  return notificationState;
}

function subscribeToNotifications(notificationListener: () => void) {
  notificationListeners.add(notificationListener);

  return () => {
    notificationListeners.delete(notificationListener);
  };
}

/** The notifications, newest first, and how many are unread. */
export function useNotifications() {
  const { notifications } = React.useSyncExternalStore(
    subscribeToNotifications,
    readNotificationState,
  );

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead)
      .length,
  };
}
