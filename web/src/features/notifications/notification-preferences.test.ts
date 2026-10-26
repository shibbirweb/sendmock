import { describe, expect, test } from "vitest";

import {
  readNotificationPreferences,
  updateNotificationPreferences,
} from "@/features/notifications/notification-preferences";

describe("notification preferences", () => {
  test("UI-08.1 toasts and their position are remembered in this browser", () => {
    expect(readNotificationPreferences()).toEqual({
      areToastsShown: true,
      toastPosition: "bottom-right",
    });

    updateNotificationPreferences({
      areToastsShown: false,
      toastPosition: "bottom-left",
    });

    expect(
      JSON.parse(
        localStorage.getItem("sendmock.notification-preferences") ?? "{}",
      ),
    ).toEqual({ areToastsShown: false, toastPosition: "bottom-left" });
    expect(readNotificationPreferences().toastPosition).toBe("bottom-left");
  });
});
