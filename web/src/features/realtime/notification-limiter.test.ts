import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createNotificationLimiter,
  describeWithOtherCount,
  notificationIntervalMs,
} from "@/features/realtime/notification-limiter";

type ShownNotification = { text: string; otherCount: number };

function createRecordingLimiter() {
  const shownNotifications: ShownNotification[] = [];
  const notificationLimiter = createNotificationLimiter<string>(
    (text, otherCount) => {
      shownNotifications.push({ text, otherCount });
    },
  );

  return { notificationLimiter, shownNotifications };
}

describe("createNotificationLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("PL-02.4 a burst shows the first at once, then the latest every 2 seconds with how many it stands for", () => {
    const { notificationLimiter, shownNotifications } =
      createRecordingLimiter();

    for (let emailNumber = 1; emailNumber <= 500; emailNumber += 1) {
      notificationLimiter.offerNotification(`Email ${emailNumber}`);
    }
    expect(shownNotifications).toEqual([{ text: "Email 1", otherCount: 0 }]);

    vi.advanceTimersByTime(notificationIntervalMs);
    expect(shownNotifications).toEqual([
      { text: "Email 1", otherCount: 0 },
      { text: "Email 500", otherCount: 498 },
    ]);

    vi.advanceTimersByTime(notificationIntervalMs * 3);
    expect(shownNotifications).toHaveLength(2);
  });

  test("PL-02.4 notifications that come slowly are each shown on their own", () => {
    const { notificationLimiter, shownNotifications } =
      createRecordingLimiter();

    notificationLimiter.offerNotification("Welcome");
    vi.advanceTimersByTime(500);
    notificationLimiter.offerNotification("Receipt");
    vi.advanceTimersByTime(notificationIntervalMs * 2);
    notificationLimiter.offerNotification("Reset link");

    expect(shownNotifications).toEqual([
      { text: "Welcome", otherCount: 0 },
      { text: "Receipt", otherCount: 0 },
      { text: "Reset link", otherCount: 0 },
    ]);
  });

  test("dispose forgets a held notification", () => {
    const { notificationLimiter, shownNotifications } =
      createRecordingLimiter();

    notificationLimiter.offerNotification("Welcome");
    notificationLimiter.offerNotification("Receipt");
    notificationLimiter.dispose();
    vi.advanceTimersByTime(notificationIntervalMs);

    expect(shownNotifications).toEqual([{ text: "Welcome", otherCount: 0 }]);
  });
});

describe("describeWithOtherCount", () => {
  test("PL-02.4 says how many more arrived", () => {
    expect(describeWithOtherCount("Order shipped", 241)).toBe(
      "Order shipped (and 241 more)",
    );
    expect(describeWithOtherCount("", 3)).toBe("and 3 more");
    expect(describeWithOtherCount("Order shipped", 0)).toBe("Order shipped");
  });
});
