import { describe, expect, test } from "vitest";

import {
  compareVersions,
  type PublishedRelease,
  selectOfferedRelease,
} from "@/mocks/updates/select-offered-release";

function buildRelease(version: string): PublishedRelease {
  return {
    version,
    publishedAt: "2026-10-01T00:00:00Z",
    isPrerelease: version.includes("-"),
    releaseNotesMarkdown: `Notes for ${version}`,
  };
}

const publishedReleases = [
  buildRelease("0.2.0-beta.1"),
  buildRelease("0.1.1"),
  buildRelease("0.1.0"),
  buildRelease("0.1.0-beta.2"),
];

describe("compareVersions", () => {
  test("orders core numbers, then a stable after its prereleases", () => {
    expect(compareVersions("0.1.1", "0.1.0")).toBeGreaterThan(0);
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.1.0-beta.2")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0-beta.10", "0.1.0-beta.2")).toBeGreaterThan(0);
    expect(compareVersions("v0.1.0", "0.1.0")).toBe(0);
  });
});

describe("selectOfferedRelease", () => {
  test("PL-05.12 offers stable installs the newest stable only", () => {
    const offeredRelease = selectOfferedRelease({
      currentVersion: "0.1.0",
      releaseChannel: "stable",
      publishedReleases,
    });

    expect(offeredRelease?.version).toBe("0.1.1");
  });

  test("PL-05.12 offers beta installs the newer of the newest beta and stable", () => {
    expect(
      selectOfferedRelease({
        currentVersion: "0.1.0-beta.2",
        releaseChannel: "beta",
        publishedReleases,
      })?.version,
    ).toBe("0.2.0-beta.1");
    expect(
      selectOfferedRelease({
        currentVersion: "0.1.0-beta.2",
        releaseChannel: "beta",
        publishedReleases: [
          buildRelease("0.1.0-beta.3"),
          buildRelease("0.1.0"),
        ],
      })?.version,
    ).toBe("0.1.0");
  });

  test("PL-05.12 offers edge and dev builds nothing", () => {
    for (const releaseChannel of ["edge", "dev"] as const) {
      expect(
        selectOfferedRelease({
          currentVersion: "0.0.0-dev",
          releaseChannel,
          publishedReleases,
        }),
      ).toBeNull();
    }
  });

  test("offers nothing when the install is already the newest", () => {
    expect(
      selectOfferedRelease({
        currentVersion: "0.1.1",
        releaseChannel: "stable",
        publishedReleases,
      }),
    ).toBeNull();
  });
});
