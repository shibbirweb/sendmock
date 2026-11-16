import { describe, expect, test } from "bun:test";

import { parseChangelog } from "./parse-changelog";
import {
  collectUpgradeNotes,
  describeWhatsNewLabel,
  selectVersionReleases,
} from "./version-notes";

const stableChangelog = parseChangelog(
  [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "## [1.1.1] - 2026-11-20",
    "",
    "### Fixed",
    "",
    "- Retries wait as long as the policy says.",
    "",
    "## [1.1.0] - 2026-11-16",
    "",
    "### Added",
    "",
    "- List actions on every screen.",
    "",
    "### Upgrade notes",
    "",
    "- `--smtp-port` is now `--smtp-listen`.",
    "",
    "## [1.0.0] - 2026-11-14",
    "",
    "### Added",
    "",
    "- The first stable release.",
    "",
  ].join("\n"),
);
const developChangelog = parseChangelog(
  [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "",
    "- Search engine metadata on the website.",
    "",
    "## [1.1.0] - 2026-11-16",
    "",
    "### Added",
    "",
    "- List actions on every screen.",
    "",
  ].join("\n"),
);

function listVersions(releases: { version: string }[]): string[] {
  return releases.map((release) => release.version);
}

describe("a docs version's notes", () => {
  test("WS-14.2 a stable or older version shows every release of its minor, newest first", () => {
    expect(
      listVersions(selectVersionReleases(stableChangelog, "stable")),
    ).toEqual(["1.1.1", "1.1.0"]);
    expect(
      listVersions(selectVersionReleases(stableChangelog, "older")),
    ).toEqual(["1.1.1", "1.1.0"]);
  });

  test("WS-14.2 the beta docs and the Preview show what the newest beta holds", () => {
    expect(
      listVersions(selectVersionReleases(developChangelog, "next")),
    ).toEqual(["Unreleased"]);
    expect(
      listVersions(selectVersionReleases(developChangelog, "preview")),
    ).toEqual(["Unreleased"]);
  });

  test("WS-14.1 the sidebar link names the version's minor, or the beta", () => {
    expect(describeWhatsNewLabel(stableChangelog, "stable")).toBe(
      "What's new in v1.1",
    );
    expect(describeWhatsNewLabel(developChangelog, "next")).toBe(
      "What's new in the beta",
    );
    expect(describeWhatsNewLabel([], "stable")).toBe("What's new");
  });

  test("WS-14.3 the upgrade notes come from each release's Upgrade notes group", () => {
    expect(
      collectUpgradeNotes(selectVersionReleases(stableChangelog, "stable")),
    ).toEqual([
      {
        version: "1.1.0",
        entries: [
          {
            text: "`--smtp-port` is now `--smtp-listen`.",
            pullRequestNumber: null,
          },
        ],
      },
    ]);
    expect(
      collectUpgradeNotes(selectVersionReleases(developChangelog, "next")),
    ).toEqual([]);
  });
});
