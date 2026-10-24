import { describe, expect, test } from "vitest";

import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format/format-values";

const nowMs = Date.parse("2026-10-25T12:00:00Z");

describe("formatRelativeTime", () => {
  test("very recent times read as just now", () => {
    expect(formatRelativeTime("2026-10-25T11:59:30Z", nowMs)).toBe("just now");
  });

  test("minutes, hours and days count back from now", () => {
    expect(formatRelativeTime("2026-10-25T11:55:00Z", nowMs)).toBe(
      "5 minutes ago",
    );
    expect(formatRelativeTime("2026-10-25T09:00:00Z", nowMs)).toBe(
      "3 hours ago",
    );
    expect(formatRelativeTime("2026-10-24T12:00:00Z", nowMs)).toBe("yesterday");
  });
});

describe("formatBytes", () => {
  test("uses the largest sensible unit with one decimal", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(182_440)).toBe("178.2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("formatDateTime", () => {
  test("includes the date and the time", () => {
    const formattedDateTime = formatDateTime("2026-10-25T12:00:00Z");

    expect(formattedDateTime).toMatch(/2026/);
    expect(formattedDateTime).toMatch(/\d{1,2}:\d{2}/);
  });
});
