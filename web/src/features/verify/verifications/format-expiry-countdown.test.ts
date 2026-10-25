import { describe, expect, test } from "vitest";

import { formatExpiryCountdown } from "@/features/verify/verifications/format-expiry-countdown";

const nowMs = Date.parse("2026-10-25T10:00:00.000Z");

describe("formatExpiryCountdown", () => {
  test("VF-04.3 shows minutes and seconds left", () => {
    expect(formatExpiryCountdown("2026-10-25T10:09:41.000Z", nowMs)).toBe(
      "9:41",
    );
    expect(formatExpiryCountdown("2026-10-25T10:00:05.000Z", nowMs)).toBe(
      "0:05",
    );
  });

  test("adds hours for long TTLs", () => {
    expect(formatExpiryCountdown("2026-10-25T11:02:05.000Z", nowMs)).toBe(
      "1:02:05",
    );
  });

  test("rounds a part second up so the last second still shows", () => {
    expect(formatExpiryCountdown("2026-10-25T10:00:00.400Z", nowMs)).toBe(
      "0:01",
    );
  });

  test("returns null once the code has expired", () => {
    expect(formatExpiryCountdown("2026-10-25T10:00:00.000Z", nowMs)).toBeNull();
    expect(formatExpiryCountdown("2026-10-25T09:59:00.000Z", nowMs)).toBeNull();
  });
});
