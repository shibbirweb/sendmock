import { describe, expect, test } from "vitest";

import {
  buildSmsStatusTimeline,
  formatElapsedTime,
} from "@/features/sms/drawer/build-sms-status-timeline";

const sentAt = "2026-10-25T10:00:00.000Z";

describe("buildSmsStatusTimeline", () => {
  test("lists the history in time order with the time since the first entry", () => {
    const timelineEntries = buildSmsStatusTimeline({
      status_history: [
        {
          status: "delivered",
          at: "2026-10-25T10:00:01.800Z",
          error_code: null,
        },
        { status: "queued", at: sentAt, error_code: null },
        { status: "sent", at: "2026-10-25T10:00:00.700Z", error_code: null },
      ],
      opened_at: null,
    });

    expect(
      timelineEntries.map((timelineEntry) => [
        timelineEntry.status,
        timelineEntry.elapsedMs,
      ]),
    ).toEqual([
      ["queued", 0],
      ["sent", 700],
      ["delivered", 1800],
    ]);
  });

  test("adds the first read event as a read entry", () => {
    const timelineEntries = buildSmsStatusTimeline({
      status_history: [{ status: "delivered", at: sentAt, error_code: null }],
      opened_at: "2026-10-25T10:01:00.000Z",
    });

    expect(timelineEntries.at(-1)).toEqual({
      status: "read",
      at: "2026-10-25T10:01:00.000Z",
      errorCode: null,
      elapsedMs: 60_000,
    });
  });

  test("keeps the error code of a failed status", () => {
    const timelineEntries = buildSmsStatusTimeline({
      status_history: [{ status: "failed", at: sentAt, error_code: "30008" }],
      opened_at: null,
    });

    expect(timelineEntries[0]?.errorCode).toBe("30008");
  });

  test("returns nothing for an empty history", () => {
    expect(
      buildSmsStatusTimeline({ status_history: [], opened_at: null }),
    ).toEqual([]);
  });
});

describe("formatElapsedTime", () => {
  test("hides the first entry and picks a readable unit", () => {
    expect(formatElapsedTime(0)).toBeNull();
    expect(formatElapsedTime(700)).toBe("+700 ms");
    expect(formatElapsedTime(1800)).toBe("+1.8 s");
    expect(formatElapsedTime(30_000)).toBe("+30 s");
    expect(formatElapsedTime(120_000)).toBe("+2 min");
  });
});
