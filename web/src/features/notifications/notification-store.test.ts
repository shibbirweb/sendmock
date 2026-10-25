import { beforeEach, describe, expect, test } from "vitest";

import {
  addNotification,
  clearNotifications,
  markAllNotificationsRead,
  maxNotifications,
  readNotificationState,
} from "@/features/notifications/notification-store";

function addEmailNotification(notificationIndex: number) {
  addNotification({
    id: `evt_${notificationIndex}`,
    area: "email",
    title: "New email",
    description: `Email ${notificationIndex}`,
    link: { kind: "email", emailId: `01EMAIL${notificationIndex}` },
    createdAt: new Date(notificationIndex * 1000).toISOString(),
  });
}

beforeEach(() => {
  clearNotifications();
});

describe("notification store", () => {
  test("UI-08.3 keeps the newest first, unread until opened, and at most 50", () => {
    for (
      let notificationIndex = 1;
      notificationIndex <= maxNotifications + 5;
      notificationIndex++
    ) {
      addEmailNotification(notificationIndex);
    }
    const { notifications } = readNotificationState();

    expect(notifications).toHaveLength(maxNotifications);
    expect(notifications[0]?.description).toBe("Email 55");
    expect(notifications.every((notification) => !notification.isRead)).toBe(
      true,
    );

    markAllNotificationsRead();
    expect(
      readNotificationState().notifications.every(
        (notification) => notification.isRead,
      ),
    ).toBe(true);
  });

  test("UI-08.3 Clear all empties the list", () => {
    addEmailNotification(1);
    clearNotifications();

    expect(readNotificationState().notifications).toEqual([]);
  });
});
