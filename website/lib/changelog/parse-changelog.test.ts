import { describe, expect, test } from "bun:test";

import { parseChangelog } from "./parse-changelog";

const changelogMarkdown = [
  "# Changelog",
  "",
  "Every SendMock release, newest first.",
  "",
  "## 0.1.0-beta.2 - 2026-11-08",
  "",
  "### Fixed",
  "",
  "- Keep the toast position after a reload (#41)",
  "",
  "## 0.1.0-beta.1 - 2026-11-01",
  "",
  "### Added",
  "",
  "- Catch email over SMTP (#50)",
  "- Show the OTP beside each email (#51)",
  "",
].join("\n");

describe("parseChangelog", () => {
  test("reads each release with its groups and linked pull requests, newest first", () => {
    expect(parseChangelog(changelogMarkdown)).toEqual([
      {
        version: "0.1.0-beta.2",
        releaseDate: "2026-11-08",
        groups: [
          {
            heading: "Fixed",
            entries: [
              {
                text: "Keep the toast position after a reload",
                pullRequestNumber: 41,
              },
            ],
          },
        ],
      },
      {
        version: "0.1.0-beta.1",
        releaseDate: "2026-11-01",
        groups: [
          {
            heading: "Added",
            entries: [
              { text: "Catch email over SMTP", pullRequestNumber: 50 },
              { text: "Show the OTP beside each email", pullRequestNumber: 51 },
            ],
          },
        ],
      },
    ]);
  });

  test("reads a missing or empty changelog as no releases", () => {
    expect(parseChangelog("")).toEqual([]);
  });
});
