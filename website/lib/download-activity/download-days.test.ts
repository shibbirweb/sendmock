import { describe, expect, test } from "bun:test";

import {
  buildDownloadDays,
  findDownloadLevel,
  mergeDownloadSources,
} from "./download-days";

const today = new Date("2026-11-21T09:30:00Z");

describe("buildDownloadDays", () => {
  test("WS-15.1 shows the 7 days up to yesterday, oldest first, the busiest at the top level", () => {
    const downloadDays = buildDownloadDays(
      {
        npm: {
          "2026-11-14": 100,
          "2026-11-15": 0,
          "2026-11-16": 400,
          "2026-11-17": 200,
          "2026-11-18": 50,
          "2026-11-19": 300,
          "2026-11-20": 1,
        },
      },
      today,
    );

    expect(downloadDays.map((downloadDay) => downloadDay.date)).toEqual([
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
    expect(downloadDays.map((downloadDay) => downloadDay.level)).toEqual([
      1, 0, 4, 2, 1, 3, 1,
    ]);
  });

  test("WS-15.2 adds every source's downloads on the same day", () => {
    const downloadDays = buildDownloadDays(
      {
        npm: { "2026-11-20": 300 },
        crates: { "2026-11-20": 20 },
        pypi: { "2026-11-20": 5, "2026-11-19": 7 },
      },
      today,
    );

    expect(downloadDays.at(-1)).toEqual({
      date: "2026-11-20",
      downloads: 325,
      level: 4,
    });
    expect(downloadDays.at(-2)?.downloads).toBe(7);
  });

  test("WS-15.2 with no data shows the 7 days up to yesterday, all at level 0", () => {
    const downloadDays = buildDownloadDays({}, today);

    expect(downloadDays).toHaveLength(7);
    expect(downloadDays.at(-1)?.date).toBe("2026-11-20");
    expect(downloadDays.every((downloadDay) => downloadDay.level === 0)).toBe(
      true,
    );
  });

  test("WS-15.1 ends on the newest reported day when the registries are a day behind", () => {
    const downloadDays = buildDownloadDays(
      { npm: { "2026-11-19": 10, "2026-11-13": 4 } },
      today,
    );

    expect(downloadDays.at(-1)?.date).toBe("2026-11-19");
    expect(downloadDays[0]?.date).toBe("2026-11-13");
  });

  test("WS-15.1 leaves today's unfinished day out", () => {
    const downloadDays = buildDownloadDays(
      { crates: { "2026-11-21": 900, "2026-11-20": 3 } },
      today,
    );

    expect(downloadDays.at(-1)).toEqual({
      date: "2026-11-20",
      downloads: 3,
      level: 4,
    });
  });
});

describe("mergeDownloadSources", () => {
  test("WS-15.3 the live sources replace the build's and PyPI keeps its build days", () => {
    const mergedSources = mergeDownloadSources(
      {
        npm: { "2026-11-19": 1 },
        crates: { "2026-11-19": 2 },
        pypi: { "2026-11-19": 3 },
      },
      { npm: { "2026-11-20": 10 }, crates: { "2026-11-20": 20 } },
    );

    expect(mergedSources).toEqual({
      npm: { "2026-11-20": 10 },
      crates: { "2026-11-20": 20 },
      pypi: { "2026-11-19": 3 },
    });
  });

  test("WS-15.3 a source the browser could not read keeps its build days", () => {
    const mergedSources = mergeDownloadSources(
      { npm: { "2026-11-19": 1 }, crates: { "2026-11-19": 2 } },
      { npm: { "2026-11-20": 10 } },
    );

    expect(mergedSources.crates).toEqual({ "2026-11-19": 2 });
  });
});

describe("findDownloadLevel", () => {
  test("WS-15.1 gives no downloads level 0 and the busiest day level 4", () => {
    expect(findDownloadLevel(0, 500)).toBe(0);
    expect(findDownloadLevel(500, 500)).toBe(4);
    expect(findDownloadLevel(1, 500)).toBe(1);
    expect(findDownloadLevel(250, 500)).toBe(2);
    expect(findDownloadLevel(10, 0)).toBe(0);
  });
});
