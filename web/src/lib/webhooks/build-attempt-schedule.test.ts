import { describe, expect, test } from "vitest";

import {
  buildAttemptSchedule,
  formatScheduleSeconds,
  parseDelayText,
} from "@/lib/webhooks/build-attempt-schedule";

describe("buildAttemptSchedule", () => {
  test("WH-01.5 adds each delay to the previous attempt", () => {
    expect(
      buildAttemptSchedule({
        max_attempts: 5,
        backoff_seconds: [1, 5, 30, 120, 600],
        retry_on_client_errors: false,
      }),
    ).toEqual([0, 1, 6, 36, 156]);
  });

  test("WH-01.5 repeats the last delay when there are more retries than delays", () => {
    expect(
      buildAttemptSchedule({
        max_attempts: 4,
        backoff_seconds: [10],
        retry_on_client_errors: false,
      }),
    ).toEqual([0, 10, 20, 30]);
  });

  test("one attempt has no retries", () => {
    expect(
      buildAttemptSchedule({
        max_attempts: 1,
        backoff_seconds: [5],
        retry_on_client_errors: false,
      }),
    ).toEqual([0]);
  });
});

describe("formatScheduleSeconds", () => {
  test("formats seconds, minutes and hours", () => {
    expect(formatScheduleSeconds(0)).toBe("0 s");
    expect(formatScheduleSeconds(156)).toBe("2 m 36 s");
    expect(formatScheduleSeconds(600)).toBe("10 m");
    expect(formatScheduleSeconds(7260)).toBe("2 h 1 m");
    expect(formatScheduleSeconds(3600)).toBe("1 h");
  });
});

describe("parseDelayText", () => {
  test("reads plain seconds and s, m, h units", () => {
    expect(parseDelayText("30")).toBe(30);
    expect(parseDelayText("30s")).toBe(30);
    expect(parseDelayText("2m")).toBe(120);
    expect(parseDelayText(" 1 H ")).toBe(3600);
  });

  test("returns null for anything else", () => {
    expect(parseDelayText("soon")).toBeNull();
    expect(parseDelayText("-5")).toBeNull();
    expect(parseDelayText("1.5m")).toBeNull();
  });
});
