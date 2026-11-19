import { describe, expect, test } from "vitest";

import { parseChangelogReleases } from "@/mocks/updates/changelog-releases";

const sampleChangelog = [
  "# Changelog",
  "",
  "Write every user-visible change under **Unreleased**.",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- Not released yet",
  "",
  "## [1.2.0] - 2026-11-16",
  "",
  "### Fixed",
  "",
  "- **Chocolatey package:** shows the SendMock icon.",
  "",
  "## [1.1.0] - 2026-11-15\r",
  "",
  "### Added",
  "",
  "- **List actions:** on every traffic screen.",
].join("\n");

describe("parseChangelogReleases", () => {
  test("PL-05.11 reads each dated stable section with its date and notes, newest first", () => {
    expect(parseChangelogReleases(sampleChangelog)).toEqual([
      {
        version: "1.2.0",
        releasedOn: "2026-11-16",
        notesMarkdown:
          "### Fixed\n\n- **Chocolatey package:** shows the SendMock icon.",
      },
      {
        version: "1.1.0",
        releasedOn: "2026-11-15",
        notesMarkdown:
          "### Added\n\n- **List actions:** on every traffic screen.",
      },
    ]);
  });

  test("PL-05.11 leaves out Unreleased and returns nothing before the first stable", () => {
    expect(
      parseChangelogReleases("# Changelog\n\n## [Unreleased]\n\n- Soon\n"),
    ).toEqual([]);
  });
});
