import { describe, expect, test } from "bun:test";

import {
  extractReleaseNotes,
  insertChangelogSection,
  renderChangelogSection,
} from "./changelog";

const mergedPullRequests = [
  {
    number: 37,
    title: "feat:[U3] add Inbox and Messages to the Mail and SMS sidebar menus",
  },
  { number: 41, title: "fix:[U3] keep the toast position after a reload" },
  { number: 42, title: "feat!:[P1] rename the native send endpoint" },
  { number: 43, title: "docs:[U3] explain the seed file" },
  { number: 44, title: "chore: update dependencies" },
  { number: 45, title: "ci: cache Playwright" },
  { number: 46, title: "test:[U3] cover the bell" },
  { number: 47, title: "refactor: split the mail list" },
];

describe("renderChangelogSection (DS-05.4)", () => {
  test("DS-05.4 groups user-facing pull requests and leaves maintenance out", () => {
    expect(
      renderChangelogSection("0.4.0-beta.1", "2026-11-02", mergedPullRequests),
    ).toBe(
      [
        "## 0.4.0-beta.1 - 2026-11-02",
        "",
        "### Breaking changes",
        "",
        "- Rename the native send endpoint (#42)",
        "",
        "### Added",
        "",
        "- Add Inbox and Messages to the Mail and SMS sidebar menus (#37)",
        "",
        "### Fixed",
        "",
        "- Keep the toast position after a reload (#41)",
        "",
      ].join("\n"),
    );
  });

  test("says so when a release has only maintenance", () => {
    expect(
      renderChangelogSection("0.4.1", "2026-11-03", [
        mergedPullRequests[4] ?? { number: 0, title: "" },
      ]),
    ).toContain("Maintenance only");
  });
});

describe("insertChangelogSection", () => {
  test("DS-05.4 creates the file and puts each new section on top", () => {
    const firstChangelog = insertChangelogSection(
      null,
      "## 0.1.0-beta.1 - 2026-11-01\n\n### Added\n\n- First (#1)\n",
    );
    const secondChangelog = insertChangelogSection(
      firstChangelog,
      "## 0.1.0-beta.2 - 2026-11-08\n\n### Fixed\n\n- Second (#2)\n",
    );

    expect(firstChangelog).toStartWith("# Changelog\n");
    expect(secondChangelog.indexOf("## 0.1.0-beta.2")).toBeLessThan(
      secondChangelog.indexOf("## 0.1.0-beta.1"),
    );
    expect(secondChangelog.match(/# Changelog/g)).toHaveLength(1);
  });
});

describe("extractReleaseNotes", () => {
  test("returns a version's section without its heading", () => {
    const changelog = insertChangelogSection(
      insertChangelogSection(
        null,
        "## 0.1.0-beta.1 - 2026-11-01\n\n### Added\n\n- First (#1)\n",
      ),
      "## 0.1.0-beta.2 - 2026-11-08\n\n### Fixed\n\n- Second (#2)\n",
    );

    expect(extractReleaseNotes(changelog, "0.1.0-beta.1")).toBe(
      "### Added\n\n- First (#1)",
    );
    expect(extractReleaseNotes(changelog, "0.1.0-beta.2")).toBe(
      "### Fixed\n\n- Second (#2)",
    );
    expect(extractReleaseNotes(changelog, "9.9.9")).toBeNull();
  });
});
