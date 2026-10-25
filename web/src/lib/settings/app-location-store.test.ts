import { describe, expect, test, vi } from "vitest";

import {
  readStoredAppLocation,
  storeAppLocation,
  subscribeToAppLocation,
} from "@/lib/settings/app-location-store";

describe("app location store", () => {
  test("UI-04.3 remembers the choice and tells every subscriber", () => {
    const appLocationListener = vi.fn();
    const unsubscribe = subscribeToAppLocation(appLocationListener);

    storeAppLocation("compose");

    expect(readStoredAppLocation()).toBe("compose");
    expect(localStorage.getItem("sendmock.app-location")).toBe("compose");
    expect(appLocationListener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
