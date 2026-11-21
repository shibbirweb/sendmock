import { describe, expect, test } from "bun:test";

import {
  decodeCachedDownloadActivity,
  downloadActivityMaxAgeMs,
  encodeCachedDownloadActivity,
  isDownloadActivityFresh,
  parseDownloadSources,
} from "./download-activity-cache";

describe("the live numbers' cache", () => {
  test("WS-15.3 reads back what it saved", () => {
    const sources = { npm: { "2026-11-20": 12 }, crates: { "2026-11-20": 3 } };

    const cachedActivity = decodeCachedDownloadActivity(
      encodeCachedDownloadActivity(sources, 1_000),
    );

    expect(cachedActivity).toEqual({ savedAt: 1_000, sources });
  });

  test("WS-15.3 treats a missing or corrupt entry as no cache", () => {
    expect(decodeCachedDownloadActivity(null)).toBeNull();
    expect(decodeCachedDownloadActivity("not json")).toBeNull();
    expect(
      decodeCachedDownloadActivity(
        JSON.stringify({ savedAt: 1, sources: { npm: { day: "many" } } }),
      ),
    ).toBeNull();
    expect(
      decodeCachedDownloadActivity(JSON.stringify({ sources: {} })),
    ).toBeNull();
  });

  test("WS-15.3 keeps the numbers for 4 hours", () => {
    const savedAt = 10_000;

    expect(isDownloadActivityFresh(savedAt, savedAt + 1)).toBe(true);
    expect(
      isDownloadActivityFresh(savedAt, savedAt + downloadActivityMaxAgeMs - 1),
    ).toBe(true);
    expect(
      isDownloadActivityFresh(savedAt, savedAt + downloadActivityMaxAgeMs),
    ).toBe(false);
    expect(downloadActivityMaxAgeMs).toBe(4 * 60 * 60 * 1000);
  });

  test("WS-15.3 treats an entry from the future as stale", () => {
    expect(isDownloadActivityFresh(5_000, 4_000)).toBe(false);
  });

  test("WS-15.2 reads a sources file only when every source is day counts", () => {
    expect(parseDownloadSources({ pypi: { "2026-11-20": 4 } })).toEqual({
      pypi: { "2026-11-20": 4 },
    });
    expect(parseDownloadSources({ pypi: ["2026-11-20"] })).toBeNull();
    expect(parseDownloadSources("npm")).toBeNull();
  });
});
