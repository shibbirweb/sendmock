import { describe, expect, test } from "bun:test";

import { parseChangelog } from "./parse-changelog";

const changelogMarkdown = [
  "# Changelog",
  "",
  "All notable changes to SendMock are documented in this file.",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- **Webhooks:** replay a delivery from the log.",
  "",
  "## [0.2.0] - 2026-11-08",
  "",
  "### Fixed",
  "",
  "- Keep the toast position after a reload.",
  "",
  "## [0.1.0] - 2026-11-01",
  "",
  "### Added",
  "",
  "- Catch email over SMTP.",
  "- Show the OTP beside each email.",
  "",
  "[0.1.0]: https://github.com/shibbirweb/sendmock/releases/tag/v0.1.0",
  "",
].join("\n");

describe("parseChangelog", () => {
  test("DS-05.4 reads [Unreleased] first, then each dated release with its groups", () => {
    expect(parseChangelog(changelogMarkdown)).toEqual([
      {
        version: "Unreleased",
        releaseDate: "",
        groups: [
          {
            heading: "Added",
            entries: [
              {
                text: "**Webhooks:** replay a delivery from the log.",
                pullRequestNumber: null,
              },
            ],
          },
        ],
      },
      {
        version: "0.2.0",
        releaseDate: "2026-11-08",
        groups: [
          {
            heading: "Fixed",
            entries: [
              {
                text: "Keep the toast position after a reload.",
                pullRequestNumber: null,
              },
            ],
          },
        ],
      },
      {
        version: "0.1.0",
        releaseDate: "2026-11-01",
        groups: [
          {
            heading: "Added",
            entries: [
              { text: "Catch email over SMTP.", pullRequestNumber: null },
              {
                text: "Show the OTP beside each email.",
                pullRequestNumber: null,
              },
            ],
          },
        ],
      },
    ]);
  });

  test("DS-05.4 leaves out an empty [Unreleased] and reads a missing changelog as nothing", () => {
    expect(
      parseChangelog(
        "# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-11-08\n\n### Fixed\n\n- A fix.\n",
      ).map((release) => release.version),
    ).toEqual(["0.2.0"]);
    expect(parseChangelog("")).toEqual([]);
  });
});
