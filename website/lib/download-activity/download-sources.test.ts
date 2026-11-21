import { describe, expect, test } from "bun:test";

import { type DownloadSource, downloadSources } from "./download-sources";

function findSource(sourceKey: string): DownloadSource {
  const source = downloadSources.find(
    (downloadSource) => downloadSource.key === sourceKey,
  );
  if (!source) {
    throw new Error(`No download source ${sourceKey}`);
  }
  return source;
}

describe("npm", () => {
  const npmSource = findSource("npm");

  test("WS-15.2 asks for sendmock and sendmock-testcontainers up to yesterday in one request", () => {
    expect(npmSource.buildUrl(new Date("2026-11-21T08:00:00Z"))).toBe(
      "https://api.npmjs.org/downloads/range/2026-11-11:2026-11-20/sendmock,sendmock-testcontainers",
    );
  });

  test("WS-15.2 adds both packages' downloads per day", () => {
    const dailyDownloads = npmSource.parseDailyDownloads({
      sendmock: {
        downloads: [
          { day: "2026-11-19", downloads: 30 },
          { day: "2026-11-20", downloads: 40 },
        ],
      },
      "sendmock-testcontainers": {
        downloads: [{ day: "2026-11-20", downloads: 2 }],
      },
    });

    expect(dailyDownloads).toEqual({ "2026-11-19": 30, "2026-11-20": 42 });
  });

  test("WS-15.2 skips a package npm does not know", () => {
    const dailyDownloads = npmSource.parseDailyDownloads({
      sendmock: { downloads: [{ day: "2026-11-20", downloads: 5 }] },
      "sendmock-testcontainers": null,
    });

    expect(dailyDownloads).toEqual({ "2026-11-20": 5 });
  });

  test("WS-15.2 reads an unexpected answer as no data", () => {
    expect(npmSource.parseDailyDownloads({ error: "not found" })).toBeNull();
    expect(npmSource.parseDailyDownloads(null)).toBeNull();
  });
});

describe("crates.io", () => {
  const cratesSource = findSource("crates");

  test("WS-15.2 adds every version's downloads and the older versions' per day", () => {
    const dailyDownloads = cratesSource.parseDailyDownloads({
      version_downloads: [
        { version: 2, downloads: 10, date: "2026-11-20" },
        { version: 1, downloads: 3, date: "2026-11-20" },
        { version: 2, downloads: 4, date: "2026-11-19" },
      ],
      meta: { extra_downloads: [{ date: "2026-11-20", downloads: 1 }] },
    });

    expect(dailyDownloads).toEqual({ "2026-11-19": 4, "2026-11-20": 14 });
  });

  test("WS-15.2 reads an answer without version downloads as no data", () => {
    expect(
      cratesSource.parseDailyDownloads({ errors: [{ detail: "Not Found" }] }),
    ).toBeNull();
  });
});

describe("PyPI", () => {
  const pypiSource = findSource("pypi");

  test("WS-15.2 counts the downloads without mirrors", () => {
    const dailyDownloads = pypiSource.parseDailyDownloads({
      data: [
        { category: "with_mirrors", date: "2026-11-20", downloads: 90 },
        { category: "without_mirrors", date: "2026-11-20", downloads: 12 },
      ],
    });

    expect(dailyDownloads).toEqual({ "2026-11-20": 12 });
  });

  test("WS-15.3 is read at build only, since pypistats blocks browser requests", () => {
    expect(pypiSource.isBrowserReadable).toBe(false);
    expect(findSource("npm").isBrowserReadable).toBe(true);
    expect(findSource("crates").isBrowserReadable).toBe(true);
  });
});
