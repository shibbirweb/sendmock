import { describe, expect, test } from "bun:test";

import {
  browserReadableSources,
  fetchDownloadSources,
} from "./fetch-download-sources";

const today = new Date("2026-11-21T08:00:00Z");

const registryAnswers: Record<string, unknown> = {
  "api.npmjs.org": {
    sendmock: { downloads: [{ day: "2026-11-20", downloads: 50 }] },
    "sendmock-testcontainers": { downloads: [] },
  },
  "crates.io": {
    version_downloads: [{ version: 1, downloads: 6, date: "2026-11-20" }],
  },
  "pypistats.org": {
    data: [{ category: "without_mirrors", date: "2026-11-20", downloads: 2 }],
  },
};

function answerFromFixtures(failingHost?: string) {
  return async (url: string) => {
    const host = new URL(url).host;
    if (host === failingHost) {
      throw new Error("registry unreachable");
    }
    return registryAnswers[host] ?? null;
  };
}

describe("fetchDownloadSources", () => {
  test("WS-15.2 reads npm, crates.io and PyPI at build", async () => {
    const fetchedSources = await fetchDownloadSources(
      answerFromFixtures(),
      today,
    );

    expect(fetchedSources).toEqual({
      npm: { "2026-11-20": 50 },
      crates: { "2026-11-20": 6 },
      pypi: { "2026-11-20": 2 },
    });
  });

  test("WS-15.2 leaves out a source that fails and keeps the others", async () => {
    const fetchedSources = await fetchDownloadSources(
      answerFromFixtures("crates.io"),
      today,
    );

    expect(Object.keys(fetchedSources).sort()).toEqual(["npm", "pypi"]);
  });

  test("WS-15.2 leaves out a source whose answer is not the expected shape", async () => {
    const fetchedSources = await fetchDownloadSources(
      async (url) =>
        new URL(url).host === "api.npmjs.org"
          ? { unexpected: true }
          : answerFromFixtures()(url),
      today,
    );

    expect(fetchedSources.npm).toBeUndefined();
    expect(fetchedSources.crates).toEqual({ "2026-11-20": 6 });
  });

  test("WS-15.2 with every source failing gives no data and does not throw", async () => {
    const fetchedSources = await fetchDownloadSources(async () => {
      throw new Error("offline");
    }, today);

    expect(fetchedSources).toEqual({});
  });

  test("WS-15.3 the browser asks npm and crates.io only", async () => {
    const askedHosts: string[] = [];
    await fetchDownloadSources(
      async (url) => {
        askedHosts.push(new URL(url).host);
        return null;
      },
      today,
      browserReadableSources,
    );

    expect(askedHosts.sort()).toEqual(["api.npmjs.org", "crates.io"]);
  });
});
