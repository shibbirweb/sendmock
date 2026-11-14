import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "sonner";

import {
  clearNotifications,
  readNotificationState,
} from "@/features/notifications/notification-store";
import {
  announceRealtimeEvents,
  createToastLimiter,
} from "@/features/realtime/announce-realtime-events";
import { notificationIntervalMs } from "@/features/realtime/notification-limiter";
import type { AppEvent } from "@/lib/api/types";

vi.mock("sonner", () => ({ toast: vi.fn() }));

function buildNewEmailEvent(emailNumber: number): AppEvent {
  return {
    id: `evt_${emailNumber}`,
    type: "email.received",
    created_at: "2026-11-12T10:00:00Z",
    data: { id: `email_${emailNumber}`, subject: `Order ${emailNumber}` },
  };
}

describe("announceRealtimeEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(toast).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearNotifications();
  });

  test("PL-02.4 a burst puts every event in the bell but shows one toast every 2 seconds", () => {
    const toastLimiter = createToastLimiter();

    announceRealtimeEvents(
      Array.from({ length: 300 }, (_, emailIndex) =>
        buildNewEmailEvent(emailIndex + 1),
      ),
      toastLimiter,
    );
    expect(vi.mocked(toast).mock.calls).toEqual([
      ["New email", { description: "Order 1" }],
    ]);
    vi.advanceTimersByTime(notificationIntervalMs);

    expect(vi.mocked(toast).mock.calls[1]).toEqual([
      "New email",
      { description: "Order 300 (and 298 more)" },
    ]);
    expect(readNotificationState().notifications[0]?.description).toBe(
      "Order 300",
    );
    toastLimiter.dispose();
  });

  test("events worth no notification stay out of the bell and show no toast", () => {
    const toastLimiter = createToastLimiter();

    announceRealtimeEvents(
      [{ ...buildNewEmailEvent(1), type: "test.ping" }],
      toastLimiter,
    );

    expect(readNotificationState().notifications).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
    toastLimiter.dispose();
  });
});
