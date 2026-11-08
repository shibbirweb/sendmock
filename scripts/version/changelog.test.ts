import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  extractReleaseNotes,
  hasUnreleasedEntries,
  prepareChangelogForRelease,
  readChangelogSection,
} from "./changelog";

const changelogIntro =
  "# Changelog\n\nAll notable changes to SendMock are documented in this file.\n";
const changelogWithUnreleased = [
  changelogIntro,
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- Webhook replay from the delivery log.",
  "",
  "### Fixed",
  "",
  "- Retries wait as long as the policy says.",
  "",
  "## [0.3.0] - 2026-10-01",
  "",
  "### Added",
  "",
  "- SMS threads.",
  "",
  "[0.3.0]: https://github.com/shibbirweb/sendmock/releases/tag/v0.3.0",
  "",
].join("\n");
const changelogWithEmptyUnreleased = [
  changelogIntro,
  "## [Unreleased]",
  "",
  "## [0.3.0] - 2026-10-01",
  "",
  "### Added",
  "",
  "- SMS threads.",
  "",
].join("\n");

describe("the changelog sections (DS-05.4)", () => {
  test("DS-05.4 reads [Unreleased] and a dated section, without link references", () => {
    expect(readChangelogSection(changelogWithUnreleased)).toBe(
      "### Added\n\n- Webhook replay from the delivery log.\n\n### Fixed\n\n- Retries wait as long as the policy says.",
    );
    expect(readChangelogSection(changelogWithUnreleased, "0.3.0")).toBe(
      "### Added\n\n- SMS threads.",
    );
    expect(readChangelogSection(changelogWithUnreleased, "0.2.0")).toBeNull();
  });

  test("DS-05.4 knows whether [Unreleased] holds any entry", () => {
    expect(hasUnreleasedEntries(changelogWithUnreleased)).toBe(true);
    expect(hasUnreleasedEntries(changelogWithEmptyUnreleased)).toBe(false);
  });
});

describe("preparing the changelog for a release (DS-05.4)", () => {
  test("DS-05.4 a beta takes [Unreleased] as it is and changes nothing", () => {
    expect(
      prepareChangelogForRelease(
        changelogWithUnreleased,
        "0.4.0-beta.1",
        "2026-11-09",
      ),
    ).toEqual({ changelog: changelogWithUnreleased });
  });

  test("DS-05.4 a stable dates [Unreleased] and puts an empty one above it", () => {
    const prepared = prepareChangelogForRelease(
      changelogWithUnreleased,
      "0.4.0",
      "2026-11-09",
    );
    const datedChangelog = "changelog" in prepared ? prepared.changelog : "";

    expect(datedChangelog).toContain(
      "## [Unreleased]\n\n## [0.4.0] - 2026-11-09\n\n### Added\n\n- Webhook replay",
    );
    expect(hasUnreleasedEntries(datedChangelog)).toBe(false);
    expect(readChangelogSection(datedChangelog, "0.4.0")).toBe(
      readChangelogSection(changelogWithUnreleased),
    );
  });

  test("DS-05.4 a release with nothing under [Unreleased] is refused", () => {
    for (const version of ["0.4.0-beta.1", "0.4.0"]) {
      const prepared = prepareChangelogForRelease(
        changelogWithEmptyUnreleased,
        version,
        "2026-11-09",
      );
      expect("refusal" in prepared && prepared.refusal, version).toContain(
        "nothing under [Unreleased]",
      );
    }
  });

  test("DS-05.4 a stable that already has its section is refused", () => {
    const prepared = prepareChangelogForRelease(
      changelogWithUnreleased,
      "0.3.0",
      "2026-11-09",
    );

    expect("refusal" in prepared && prepared.refusal).toContain(
      "already has a [0.3.0] section",
    );
  });
});

describe("release notes (DS-05.5)", () => {
  test("DS-05.5 a beta's notes are [Unreleased] and a stable's its dated section", () => {
    expect(extractReleaseNotes(changelogWithUnreleased, "0.4.0-beta.2")).toBe(
      readChangelogSection(changelogWithUnreleased),
    );
    expect(extractReleaseNotes(changelogWithUnreleased, "0.3.0")).toBe(
      "### Added\n\n- SMS threads.",
    );
  });

  test("DS-05.4 this repository's CHANGELOG.md keeps an [Unreleased] section to write into", () => {
    const repositoryChangelog = readFileSync(
      join(import.meta.dir, "../../CHANGELOG.md"),
      "utf8",
    );

    expect(readChangelogSection(repositoryChangelog)).not.toBeNull();
  });
});
